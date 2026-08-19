using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;

namespace PelegoMarkerV3;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        using var mutex = new Mutex(true, "PELEGO_MARCADOR_DE_TELA_SINGLE", out var first);
        if (!first) return;

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        var startup = args.Any(a => a.Equals("/startup", StringComparison.OrdinalIgnoreCase));
        Application.Run(new MainForm(startup));
    }
}

enum ToolMode { Mouse, Pen, Highlighter, Line, Arrow, Rectangle, Ellipse, Text, Eraser, Select }
enum PointerMode { Off, Ring, BigRing, Pen, Hand, Target }
enum GlyphKind
{
    Mouse, Pen, Highlighter, Line, Arrow, Rectangle, Ellipse, Text, Eraser, Select,
    Undo, Clear, Thinner, Thicker, Fill,
    PointerOff, Ring, BigRing, PointerPen, Hand, Target
}

sealed class MainForm : Form
{
    const int LauncherWidth = 58;
    const int LauncherHeight = 58;
    const int PaletteWidth = 58;
    const int DesiredPaletteHeight = 760;
    const int HOTKEY_PANIC = 3100;

    readonly CanvasForm canvas;
    readonly Timer uiTimer;
    readonly ToolTip tips = new();
    readonly Dictionary<ToolMode, GlyphButton> toolButtons = new();
    readonly Dictionary<PointerMode, GlyphButton> pointerButtons = new();
    readonly List<GlyphButton> colorButtons = new();

    Label? status;
    Label? widthLabel;
    GlyphButton? fillButton;
    bool startup;
    bool expanded;
    bool allowExit;
    bool leftWasDown;
    long pulseStarted;
    Point dragMouseStart;
    Point dragWindowStart;
    bool draggingWindow;

    ToolMode toolMode = ToolMode.Mouse;
    PointerMode pointerMode = PointerMode.Off;
    Color inkColor = Color.FromArgb(0, 120, 255);
    int inkWidth = 4;
    bool filled;
    Rectangle oldPointerRect = Rectangle.Empty;
    Bitmap? selectionSnapshot;

    public Color InkColor => inkColor;
    public float InkWidth => inkWidth;
    public bool Filled => filled;
    public ToolMode CurrentTool => toolMode;
    public PointerMode CurrentPointer => pointerMode;
    public bool PulseActive => Environment.TickCount64 - pulseStarted < 280;
    public long PulseAge => Environment.TickCount64 - pulseStarted;

    public MainForm(bool startMinimized)
    {
        startup = startMinimized;
        Text = "PELEGO Marcador de Tela 3.0";
        FormBorderStyle = FormBorderStyle.None;
        MaximizeBox = false;
        MinimizeBox = true;
        ShowInTaskbar = true;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        KeyPreview = true;
        BackColor = Color.FromArgb(238, 238, 238);
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        ClientSize = new Size(LauncherWidth, LauncherHeight);
        LoadSavedLocation();
        canvas = new CanvasForm(this);
        BuildLauncher();

        uiTimer = new Timer { Interval = 16 };
        uiTimer.Tick += UiTimer_Tick;
        uiTimer.Start();

        FormClosing += MainForm_FormClosing;
        Move += (_, _) => SaveLocation();
        Shown += (_, _) =>
        {
            RegisterPanicHotkey();
            canvas.Hide();
            BringToFront();
            if (startup)
            {
                WindowState = FormWindowState.Minimized;
                startup = false;
            }
        };

        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.Escape)
            {
                ReleaseDrawingOnly();
                e.Handled = true;
            }
        };
    }

    void BuildLauncher()
    {
        expanded = false;
        toolButtons.Clear();
        pointerButtons.Clear();
        colorButtons.Clear();
        Controls.Clear();
        ClientSize = new Size(LauncherWidth, LauncherHeight);

        var header = CreateHeader("PE...");
        Controls.Add(header);

        var start = new Button
        {
            Text = "Start",
            Left = 3,
            Top = 25,
            Width = 52,
            Height = 28,
            FlatStyle = FlatStyle.System,
            TabStop = false
        };
        start.Click += (_, _) => ExpandPalette();
        Controls.Add(start);
        tips.SetToolTip(start, "Abrir paleta no local escolhido");
    }

    void ExpandPalette()
    {
        var desiredLocation = Location;
        expanded = true;
        toolButtons.Clear();
        pointerButtons.Clear();
        colorButtons.Clear();
        Controls.Clear();

        var wa = Screen.FromPoint(desiredLocation).WorkingArea;
        var paletteHeight = Math.Min(DesiredPaletteHeight, Math.Max(500, wa.Height - 16));
        ClientSize = new Size(PaletteWidth, paletteHeight);
        Location = ClampLocation(desiredLocation, ClientSize);

        var header = CreateHeader("PE");
        Controls.Add(header);

        status = new Label
        {
            Left = 3,
            Top = 22,
            Width = 52,
            Height = 20,
            Text = "PEN",
            TextAlign = ContentAlignment.MiddleCenter,
            BackColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle,
            Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 7.5f, FontStyle.Bold)
        };
        Controls.Add(status);

        var y = 47;
        AddPointerRow(ref y, PointerMode.Ring, GlyphKind.Ring, "Ponteiro: círculo", PointerMode.BigRing, GlyphKind.BigRing, "Ponteiro: círculo grande");
        AddPointerRow(ref y, PointerMode.Pen, GlyphKind.PointerPen, "Ponteiro: caneta", PointerMode.Hand, GlyphKind.Hand, "Ponteiro: mão");
        AddPointerRow(ref y, PointerMode.Target, GlyphKind.Target, "Ponteiro: alvo", PointerMode.Off, GlyphKind.PointerOff, "Desligar aparência do ponteiro");
        y += 4;
        AddSeparator(y); y += 7;

        AddColorRow(ref y, Color.FromArgb(255, 55, 55), Color.Gold);
        AddColorRow(ref y, Color.LimeGreen, Color.FromArgb(0, 120, 255));
        AddColorRow(ref y, Color.FromArgb(255, 120, 0), Color.DeepSkyBlue);
        AddColorRow(ref y, Color.White, Color.Black);
        y += 4;
        AddSeparator(y); y += 7;

        AddToolRow(ref y, ToolMode.Mouse, GlyphKind.Mouse, "Mouse / Windows", ToolMode.Pen, GlyphKind.Pen, "Caneta");
        AddToolRow(ref y, ToolMode.Highlighter, GlyphKind.Highlighter, "Marca-texto", ToolMode.Line, GlyphKind.Line, "Linha");
        AddToolRow(ref y, ToolMode.Arrow, GlyphKind.Arrow, "Seta", ToolMode.Rectangle, GlyphKind.Rectangle, "Retângulo");
        AddToolRow(ref y, ToolMode.Ellipse, GlyphKind.Ellipse, "Elipse", ToolMode.Text, GlyphKind.Text, "Texto");
        AddToolRow(ref y, ToolMode.Eraser, GlyphKind.Eraser, "Borracha", ToolMode.Select, GlyphKind.Select, "Selecionar / copiar");
        y += 4;
        AddSeparator(y); y += 7;

        AddActionRow(ref y,
            MakeActionButton(GlyphKind.Undo, "Desfazer", () => canvas.Undo()),
            MakeActionButton(GlyphKind.Clear, "Limpar desenhos", () => canvas.ClearAll()));

        var thinner = MakeActionButton(GlyphKind.Thinner, "Diminuir espessura", () => ChangeWidth(-1));
        var thicker = MakeActionButton(GlyphKind.Thicker, "Aumentar espessura", () => ChangeWidth(+1));
        AddActionRow(ref y, thinner, thicker);

        fillButton = MakeActionButton(GlyphKind.Fill, "Preencher retângulo / elipse", ToggleFill);
        var mouseOnly = MakeActionButton(GlyphKind.PointerOff, "Soltar desenho e manter só o ponteiro", ReleaseDrawingOnly);
        AddActionRow(ref y, fillButton, mouseOnly);

        widthLabel = new Label
        {
            Left = 3,
            Top = y + 2,
            Width = 52,
            Height = 18,
            TextAlign = ContentAlignment.MiddleCenter,
            Text = $"TRAÇO {inkWidth}",
            Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 7f),
            ForeColor = Color.FromArgb(70, 70, 70)
        };
        Controls.Add(widthLabel);

        toolMode = ToolMode.Pen;
        pointerMode = PointerMode.Off;
        UpdateToolButtons();
        UpdatePointerButtons();
        UpdateFillButton();

        if (!canvas.Visible) canvas.Show();
        canvas.SetMode(ToolMode.Pen);
        canvas.SetInteractive(true);
        canvas.Invalidate();
        BringToFront();
        Activate();
    }

    Panel CreateHeader(string title)
    {
        var header = new Panel
        {
            Left = 0,
            Top = 0,
            Width = ClientSize.Width,
            Height = 20,
            BackColor = Color.FromArgb(238, 238, 238)
        };

        var label = new Label
        {
            Left = 3,
            Top = 1,
            Width = 31,
            Height = 18,
            Text = title,
            TextAlign = ContentAlignment.MiddleLeft,
            Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 7.5f)
        };

        var close = new Button
        {
            Left = ClientSize.Width - 21,
            Top = 1,
            Width = 19,
            Height = 18,
            Text = "×",
            BackColor = Color.FromArgb(205, 70, 70),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat,
            TabStop = false,
            Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 8f, FontStyle.Bold)
        };
        close.FlatAppearance.BorderSize = 0;
        close.Click += (_, _) => ExitApp();

        AttachDrag(header);
        AttachDrag(label);
        header.Controls.Add(label);
        header.Controls.Add(close);
        tips.SetToolTip(label, "Arraste para posicionar");
        tips.SetToolTip(close, "Fechar");
        return header;
    }

    void AttachDrag(Control c)
    {
        c.MouseDown += (_, e) =>
        {
            if (e.Button != MouseButtons.Left) return;
            draggingWindow = true;
            dragMouseStart = Cursor.Position;
            dragWindowStart = Location;
        };
        c.MouseMove += (_, _) =>
        {
            if (!draggingWindow || (Control.MouseButtons & MouseButtons.Left) == 0) return;
            var p = Cursor.Position;
            Location = new Point(dragWindowStart.X + p.X - dragMouseStart.X, dragWindowStart.Y + p.Y - dragMouseStart.Y);
        };
        c.MouseUp += (_, _) => draggingWindow = false;
    }

    void AddSeparator(int y)
    {
        Controls.Add(new Panel
        {
            Left = 4,
            Top = y,
            Width = 50,
            Height = 1,
            BackColor = Color.FromArgb(185, 185, 185)
        });
    }

    void AddToolRow(ref int y, ToolMode leftMode, GlyphKind leftGlyph, string leftTip, ToolMode rightMode, GlyphKind rightGlyph, string rightTip)
    {
        var a = MakeToolButton(leftMode, leftGlyph, leftTip);
        var b = MakeToolButton(rightMode, rightGlyph, rightTip);
        PlacePair(a, b, y);
        y += 25;
    }

    void AddPointerRow(ref int y, PointerMode leftMode, GlyphKind leftGlyph, string leftTip, PointerMode rightMode, GlyphKind rightGlyph, string rightTip)
    {
        var a = MakePointerButton(leftMode, leftGlyph, leftTip);
        var b = MakePointerButton(rightMode, rightGlyph, rightTip);
        PlacePair(a, b, y);
        y += 25;
    }

    void AddColorRow(ref int y, Color aColor, Color bColor)
    {
        var a = MakeColorButton(aColor);
        var b = MakeColorButton(bColor);
        PlacePair(a, b, y);
        y += 25;
    }

    void AddActionRow(ref int y, GlyphButton a, GlyphButton b)
    {
        PlacePair(a, b, y);
        y += 25;
    }

    void PlacePair(Control a, Control b, int y)
    {
        a.Left = 4; a.Top = y; a.Width = 23; a.Height = 23;
        b.Left = 31; b.Top = y; b.Width = 23; b.Height = 23;
        Controls.Add(a);
        Controls.Add(b);
    }

    GlyphButton MakeToolButton(ToolMode mode, GlyphKind glyph, string tip)
    {
        var b = new GlyphButton(glyph);
        b.Click += (_, _) => SetTool(mode);
        toolButtons[mode] = b;
        tips.SetToolTip(b, tip);
        return b;
    }

    GlyphButton MakePointerButton(PointerMode mode, GlyphKind glyph, string tip)
    {
        var b = new GlyphButton(glyph);
        b.Click += (_, _) => SetPointer(mode);
        pointerButtons[mode] = b;
        tips.SetToolTip(b, tip);
        return b;
    }

    GlyphButton MakeActionButton(GlyphKind glyph, string tip, Action action)
    {
        var b = new GlyphButton(glyph);
        b.Click += (_, _) => action();
        tips.SetToolTip(b, tip);
        return b;
    }

    GlyphButton MakeColorButton(Color color)
    {
        var b = new GlyphButton(GlyphKind.Fill) { Swatch = color };
        b.Click += (_, _) =>
        {
            inkColor = color;
            foreach (var x in colorButtons) x.Selected = ReferenceEquals(x, b);
            canvas.Invalidate();
        };
        colorButtons.Add(b);
        tips.SetToolTip(b, $"Cor {color.Name}");
        if (colorButtons.Count == 1) b.Selected = true;
        return b;
    }

    void SetTool(ToolMode mode)
    {
        if (!expanded) return;

        if (mode == ToolMode.Mouse)
        {
            ReleaseDrawingOnly();
            return;
        }

        if (mode == ToolMode.Select)
            PrepareSelectionSnapshot();

        toolMode = mode;
        if (!canvas.Visible) canvas.Show();
        canvas.SetMode(mode);
        canvas.SetInteractive(true);
        if (status != null) status.Text = ToolStatus(mode);
        UpdateToolButtons();
        BringToFront();
    }

    void SetPointer(PointerMode mode)
    {
        if (!expanded) return;
        pointerMode = mode;
        if (!canvas.Visible) canvas.Show();
        UpdatePointerButtons();
        oldPointerRect = Rectangle.Empty;
        canvas.Invalidate();
        BringToFront();
    }

    string ToolStatus(ToolMode mode) => mode switch
    {
        ToolMode.Pen => "PEN",
        ToolMode.Highlighter => "MARCA",
        ToolMode.Line => "LINHA",
        ToolMode.Arrow => "SETA",
        ToolMode.Rectangle => "RET",
        ToolMode.Ellipse => "ELIPSE",
        ToolMode.Text => "TEXTO",
        ToolMode.Eraser => "BORRA",
        ToolMode.Select => "COPIA",
        _ => "MOUSE"
    };

    void ChangeWidth(int delta)
    {
        inkWidth = Math.Clamp(inkWidth + delta, 1, 18);
        if (widthLabel != null) widthLabel.Text = $"TRAÇO {inkWidth}";
    }

    void ToggleFill()
    {
        filled = !filled;
        UpdateFillButton();
    }

    void UpdateFillButton()
    {
        if (fillButton != null) fillButton.Selected = filled;
    }

    void UpdateToolButtons()
    {
        foreach (var kv in toolButtons) kv.Value.Selected = kv.Key == toolMode;
    }

    void UpdatePointerButtons()
    {
        foreach (var kv in pointerButtons) kv.Value.Selected = kv.Key == pointerMode;
    }

    public bool IsToolbarPoint(Point screenPoint) =>
        Visible && WindowState == FormWindowState.Normal && Bounds.Contains(screenPoint);

    public void ReleaseDrawingOnly()
    {
        toolMode = ToolMode.Mouse;
        canvas.SetMode(ToolMode.Mouse);
        canvas.SetInteractive(false);
        if (status != null) status.Text = "MOUSE";
        UpdateToolButtons();
        BringToFront();
    }

    public void PanicRelease()
    {
        ReleaseDrawingOnly();
        pointerMode = PointerMode.Off;
        UpdatePointerButtons();
        oldPointerRect = Rectangle.Empty;
        canvas.Invalidate();
    }

    void ExitApp()
    {
        allowExit = true;
        try { canvas.SetInteractive(false); } catch { }
        try { canvas.Close(); } catch { }
        UnregisterPanicHotkey();
        Application.Exit();
    }

    void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
    {
        if (allowExit) return;
        e.Cancel = true;
        ExitApp();
    }

    void RegisterPanicHotkey()
    {
        if (!IsHandleCreated) return;
        Native.UnregisterHotKey(Handle, HOTKEY_PANIC);
        Native.RegisterHotKey(Handle, HOTKEY_PANIC, Native.MOD_CONTROL | Native.MOD_ALT, (uint)Keys.F12);
    }

    void UnregisterPanicHotkey()
    {
        if (IsHandleCreated) Native.UnregisterHotKey(Handle, HOTKEY_PANIC);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Native.WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_PANIC)
        {
            PanicRelease();
            return;
        }
        base.WndProc(ref m);
    }

    void UiTimer_Tick(object? sender, EventArgs e)
    {
        if (!expanded || !canvas.Visible) return;

        var cursor = Cursor.Position;
        var leftDown = (Control.MouseButtons & MouseButtons.Left) != 0;
        if (leftDown && !leftWasDown) pulseStarted = Environment.TickCount64;
        leftWasDown = leftDown;

        var next = canvas.GetPointerScreenBounds(cursor);
        Rectangle dirty;
        if (oldPointerRect.IsEmpty) dirty = next;
        else if (next.IsEmpty) dirty = oldPointerRect;
        else dirty = Rectangle.Union(oldPointerRect, next);
        oldPointerRect = next;
        if (!dirty.IsEmpty) canvas.InvalidateScreenRect(dirty);
    }

    void PrepareSelectionSnapshot()
    {
        selectionSnapshot?.Dispose();
        var canvasWasVisible = canvas.Visible;
        var oldPointer = pointerMode;
        pointerMode = PointerMode.Off;
        canvas.SetInteractive(false);
        canvas.Hide();
        Application.DoEvents();
        System.Threading.Thread.Sleep(50);

        var vs = SystemInformation.VirtualScreen;
        var bmp = new Bitmap(vs.Width, vs.Height, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
            g.CopyFromScreen(vs.Left, vs.Top, 0, 0, vs.Size, CopyPixelOperation.SourceCopy);
        selectionSnapshot = bmp;

        pointerMode = oldPointer;
        if (canvasWasVisible) canvas.Show();
        canvas.Invalidate();
        BringToFront();
    }

    public void FinishSelection(Rectangle screenRect)
    {
        if (screenRect.Width < 2 || screenRect.Height < 2 || selectionSnapshot == null)
        {
            ReleaseDrawingOnly();
            return;
        }

        var vs = SystemInformation.VirtualScreen;
        var local = new Rectangle(screenRect.X - vs.X, screenRect.Y - vs.Y, screenRect.Width, screenRect.Height);
        local.Intersect(new Rectangle(0, 0, selectionSnapshot.Width, selectionSnapshot.Height));
        if (local.Width > 0 && local.Height > 0)
        {
            using var crop = selectionSnapshot.Clone(local, PixelFormat.Format32bppArgb);
            try { Clipboard.SetImage(new Bitmap(crop)); } catch { }
            if (status != null) status.Text = "COPIOU";
        }
        selectionSnapshot.Dispose();
        selectionSnapshot = null;
        ReleaseDrawingOnly();
    }

    public void AddTextAt(Point canvasPoint)
    {
        using var dlg = new TextEntryForm(inkColor);
        var screen = canvas.PointToScreen(canvasPoint);
        dlg.StartPosition = FormStartPosition.Manual;
        dlg.Location = new Point(screen.X + 12, screen.Y + 12);
        if (dlg.ShowDialog(this) == DialogResult.OK && !string.IsNullOrWhiteSpace(dlg.Value))
            canvas.AddText(canvasPoint, dlg.Value.Trim(), inkColor, Math.Max(14f, InkWidth * 5f));
    }

    void LoadSavedLocation()
    {
        try
        {
            using var k = Registry.CurrentUser.OpenSubKey(@"Software\PELEGO\MarcadorTela");
            var p = new Point(40, 80);
            if (k?.GetValue("X") is int x && k.GetValue("Y") is int y) p = new Point(x, y);
            Location = ClampLocation(p, ClientSize);
        }
        catch { Location = new Point(40, 80); }
    }

    void SaveLocation()
    {
        if (WindowState != FormWindowState.Normal) return;
        try
        {
            using var k = Registry.CurrentUser.CreateSubKey(@"Software\PELEGO\MarcadorTela");
            k.SetValue("X", Left, RegistryValueKind.DWord);
            k.SetValue("Y", Top, RegistryValueKind.DWord);
        }
        catch { }
    }

    Point ClampLocation(Point p, Size size)
    {
        var wa = Screen.FromPoint(p).WorkingArea;
        var x = Math.Clamp(p.X, wa.Left, Math.Max(wa.Left, wa.Right - size.Width));
        var y = Math.Clamp(p.Y, wa.Top, Math.Max(wa.Top, wa.Bottom - size.Height));
        return new Point(x, y);
    }
}

sealed class GlyphButton : Button
{
    public GlyphKind Glyph { get; }
    public Color? Swatch { get; set; }
    bool selected;

    public bool Selected
    {
        get => selected;
        set { selected = value; Invalidate(); }
    }

    public GlyphButton(GlyphKind glyph)
    {
        Glyph = glyph;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        TabStop = false;
        BackColor = Color.FromArgb(242, 242, 242);
        Margin = Padding.Empty;
    }

    protected override void OnPaint(PaintEventArgs pevent)
    {
        var g = pevent.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Selected ? Color.FromArgb(205, 229, 255) : BackColor);

        var borderColor = Selected ? Color.FromArgb(0, 100, 220) : Color.FromArgb(185, 185, 185);
        using (var border = new Pen(borderColor, Selected ? 2f : 1f))
            g.DrawRectangle(border, 0, 0, Width - 1, Height - 1);

        var r = new Rectangle(4, 4, Math.Max(1, Width - 8), Math.Max(1, Height - 8));
        if (Swatch.HasValue)
        {
            using var b = new SolidBrush(Swatch.Value);
            g.FillRectangle(b, r);
            using var p = new Pen(Swatch.Value == Color.White ? Color.Gray : Color.FromArgb(120, 120, 120));
            g.DrawRectangle(p, r);
            return;
        }

        DrawGlyph(g, r, Glyph);
    }

    static void DrawGlyph(Graphics g, Rectangle r, GlyphKind glyph)
    {
        var ink = Color.FromArgb(35, 35, 35);
        using var p = new Pen(ink, 1.6f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        using var pThin = new Pen(ink, 1f);
        using var fill = new SolidBrush(ink);
        var cx = r.Left + r.Width / 2f;
        var cy = r.Top + r.Height / 2f;

        switch (glyph)
        {
            case GlyphKind.Mouse:
                var pts = new[] { new PointF(r.Left + 2, r.Top + 1), new PointF(r.Left + 2, r.Bottom - 2), new PointF(r.Left + 7, r.Bottom - 6), new PointF(r.Left + 11, r.Bottom - 1), new PointF(r.Left + 13, r.Bottom - 3), new PointF(r.Left + 9, r.Bottom - 8), new PointF(r.Right - 1, r.Bottom - 8) };
                g.DrawLines(p, pts);
                break;
            case GlyphKind.Pen:
            case GlyphKind.PointerPen:
                g.DrawLine(p, r.Left + 2, r.Bottom - 2, r.Right - 3, r.Top + 3);
                g.DrawLine(p, r.Right - 5, r.Top + 2, r.Right - 1, r.Top + 6);
                g.DrawLine(pThin, r.Left + 1, r.Bottom - 1, r.Left + 5, r.Bottom - 2);
                break;
            case GlyphKind.Highlighter:
                using (var thick = new Pen(ink, 4f) { StartCap = LineCap.Square, EndCap = LineCap.Square })
                    g.DrawLine(thick, r.Left + 3, r.Bottom - 4, r.Right - 3, r.Top + 4);
                break;
            case GlyphKind.Line:
                g.DrawLine(p, r.Left + 2, r.Bottom - 2, r.Right - 2, r.Top + 2);
                break;
            case GlyphKind.Arrow:
                g.DrawLine(p, r.Left + 1, r.Bottom - 2, r.Right - 3, r.Top + 4);
                g.DrawLine(p, r.Right - 3, r.Top + 4, r.Right - 8, r.Top + 4);
                g.DrawLine(p, r.Right - 3, r.Top + 4, r.Right - 3, r.Top + 9);
                break;
            case GlyphKind.Rectangle:
                g.DrawRectangle(pThin, r.Left + 1, r.Top + 3, r.Width - 3, r.Height - 6);
                break;
            case GlyphKind.Ellipse:
                g.DrawEllipse(pThin, r.Left + 1, r.Top + 3, r.Width - 3, r.Height - 6);
                break;
            case GlyphKind.Text:
                using (var font = new Font(SystemFonts.MessageBoxFont.FontFamily, 10f, FontStyle.Bold, GraphicsUnit.Pixel))
                    g.DrawString("A", font, fill, r.Left + 3, r.Top + 1);
                break;
            case GlyphKind.Eraser:
                var ep = new[] { new PointF(r.Left + 2, r.Bottom - 5), new PointF(r.Left + 7, r.Top + 2), new PointF(r.Right - 2, r.Top + 7), new PointF(r.Right - 7, r.Bottom - 1) };
                g.DrawPolygon(p, ep);
                g.DrawLine(pThin, r.Left + 4, r.Bottom - 5, r.Right - 5, r.Bottom - 5);
                break;
            case GlyphKind.Select:
                using (var dash = new Pen(ink, 1f) { DashStyle = DashStyle.Dash })
                    g.DrawRectangle(dash, r.Left + 1, r.Top + 2, r.Width - 3, r.Height - 4);
                break;
            case GlyphKind.Undo:
                g.DrawArc(p, r.Left + 3, r.Top + 3, r.Width - 5, r.Height - 6, 200, 250);
                g.DrawLine(p, r.Left + 2, cy, r.Left + 6, cy - 4);
                g.DrawLine(p, r.Left + 2, cy, r.Left + 7, cy + 1);
                break;
            case GlyphKind.Clear:
                g.DrawRectangle(pThin, r.Left + 4, r.Top + 5, r.Width - 8, r.Height - 7);
                g.DrawLine(p, r.Left + 3, r.Top + 4, r.Right - 3, r.Top + 4);
                g.DrawLine(p, r.Left + 6, r.Top + 1, r.Right - 6, r.Top + 1);
                break;
            case GlyphKind.Thinner:
                g.DrawLine(p, r.Left + 3, cy, r.Right - 3, cy);
                break;
            case GlyphKind.Thicker:
                g.DrawLine(p, r.Left + 3, cy, r.Right - 3, cy);
                g.DrawLine(p, cx, r.Top + 3, cx, r.Bottom - 3);
                break;
            case GlyphKind.Fill:
                g.DrawRectangle(pThin, r.Left + 2, r.Top + 2, r.Width - 4, r.Height - 4);
                using (var shade = new SolidBrush(Color.FromArgb(120, ink)))
                    g.FillRectangle(shade, r.Left + 4, (int)cy, r.Width - 8, r.Bottom - (int)cy - 2);
                break;
            case GlyphKind.PointerOff:
                g.DrawEllipse(pThin, r.Left + 2, r.Top + 2, r.Width - 4, r.Height - 4);
                g.DrawLine(p, r.Left + 3, r.Bottom - 3, r.Right - 3, r.Top + 3);
                break;
            case GlyphKind.Ring:
                g.DrawEllipse(p, r.Left + 3, r.Top + 3, r.Width - 6, r.Height - 6);
                break;
            case GlyphKind.BigRing:
                g.DrawEllipse(p, r.Left + 1, r.Top + 1, r.Width - 2, r.Height - 2);
                g.FillEllipse(fill, cx - 1.5f, cy - 1.5f, 3, 3);
                break;
            case GlyphKind.Hand:
                g.DrawLine(p, cx, r.Bottom - 2, cx, r.Top + 3);
                g.DrawLine(p, cx, r.Top + 3, cx + 2, r.Top + 1);
                g.DrawLine(p, cx + 2, r.Top + 1, cx + 4, r.Top + 4);
                g.DrawLine(p, cx + 4, r.Top + 4, cx + 6, r.Top + 3);
                g.DrawLine(p, cx + 6, r.Top + 3, cx + 7, r.Bottom - 5);
                g.DrawArc(p, r.Left + 2, (int)cy - 1, r.Width - 5, r.Height / 2, 0, 180);
                break;
            case GlyphKind.Target:
                g.DrawEllipse(pThin, r.Left + 3, r.Top + 3, r.Width - 6, r.Height - 6);
                g.DrawLine(pThin, cx, r.Top, cx, r.Bottom);
                g.DrawLine(pThin, r.Left, cy, r.Right, cy);
                g.FillEllipse(fill, cx - 1.5f, cy - 1.5f, 3, 3);
                break;
        }
    }
}

sealed class CanvasForm : Form
{
    readonly MainForm owner;
    readonly List<InkShape> shapes = new();
    readonly Native.LowLevelMouseProc mouseProc;
    IntPtr mouseHook = IntPtr.Zero;

    InkShape? current;
    ToolMode mode = ToolMode.Mouse;
    Point start;
    Point last;
    bool dragging;
    Rectangle selectionRect = Rectangle.Empty;
    Rectangle oldSelectionRect = Rectangle.Empty;
    bool interactive;
    bool textDialogPending;

    public CanvasForm(MainForm owner)
    {
        this.owner = owner;
        mouseProc = HookCallback;
        var vs = SystemInformation.VirtualScreen;
        StartPosition = FormStartPosition.Manual;
        Location = vs.Location;
        Size = vs.Size;
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        BackColor = Color.Fuchsia;
        TransparencyKey = Color.Fuchsia;
        DoubleBuffered = true;
        KeyPreview = false;
    }

    protected override bool ShowWithoutActivation => true;

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ExStyle |= Native.WS_EX_TOOLWINDOW | Native.WS_EX_NOACTIVATE | Native.WS_EX_TRANSPARENT;
            return cp;
        }
    }

    protected override void OnHandleDestroyed(EventArgs e)
    {
        UninstallMouseHook();
        base.OnHandleDestroyed(e);
    }

    public void SetMode(ToolMode m)
    {
        mode = m;
        dragging = false;
        current = null;
        selectionRect = Rectangle.Empty;
        Invalidate();
    }

    public void SetInteractive(bool value)
    {
        interactive = value;
        if (value) InstallMouseHook();
        else
        {
            dragging = false;
            current = null;
            UninstallMouseHook();
        }

        if (!IsHandleCreated) return;
        var style = Native.GetWindowLong(Handle, Native.GWL_EXSTYLE);
        style |= Native.WS_EX_TRANSPARENT | Native.WS_EX_NOACTIVATE | Native.WS_EX_TOOLWINDOW;
        Native.SetWindowLong(Handle, Native.GWL_EXSTYLE, style);
        Native.SetWindowPos(Handle, IntPtr.Zero, 0, 0, 0, 0,
            Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOZORDER | Native.SWP_NOACTIVATE | Native.SWP_FRAMECHANGED);
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        if (interactive) InstallMouseHook();
    }

    void InstallMouseHook()
    {
        if (!interactive || mouseHook != IntPtr.Zero || !IsHandleCreated) return;
        try
        {
            using var process = Process.GetCurrentProcess();
            var moduleName = process.MainModule?.ModuleName;
            var module = Native.GetModuleHandle(moduleName);
            mouseHook = Native.SetWindowsHookEx(Native.WH_MOUSE_LL, mouseProc, module, 0);
        }
        catch { mouseHook = IntPtr.Zero; }
    }

    void UninstallMouseHook()
    {
        if (mouseHook == IntPtr.Zero) return;
        try { Native.UnhookWindowsHookEx(mouseHook); } catch { }
        mouseHook = IntPtr.Zero;
    }

    IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode < 0 || !interactive)
            return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);

        var data = Marshal.PtrToStructure<Native.MSLLHOOKSTRUCT>(lParam);
        var screenPoint = new Point(data.pt.X, data.pt.Y);
        if (owner.IsToolbarPoint(screenPoint))
            return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);

        var msg = wParam.ToInt32();
        var local = new Point(screenPoint.X - Left, screenPoint.Y - Top);

        if (msg == Native.WM_RBUTTONDOWN)
        {
            try { BeginInvoke(new Action(owner.ReleaseDrawingOnly)); } catch { }
            return (IntPtr)1;
        }
        if (msg == Native.WM_RBUTTONUP) return (IntPtr)1;

        if (msg == Native.WM_LBUTTONDOWN)
        {
            if (mode == ToolMode.Text)
            {
                RequestText(local);
                return (IntPtr)1;
            }
            HandleMouseDown(local);
            return (IntPtr)1;
        }

        if (msg == Native.WM_MOUSEMOVE && dragging)
        {
            HandleMouseMove(local);
            return (IntPtr)1;
        }

        if (msg == Native.WM_LBUTTONUP)
        {
            if (dragging) HandleMouseUp(local);
            return (IntPtr)1;
        }

        return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);
    }

    void RequestText(Point local)
    {
        if (textDialogPending) return;
        textDialogPending = true;
        try
        {
            BeginInvoke(new Action(() =>
            {
                SetInteractive(false);
                try { owner.AddTextAt(local); }
                finally
                {
                    textDialogPending = false;
                    if (owner.CurrentTool == ToolMode.Text && Visible && owner.WindowState == FormWindowState.Normal)
                        SetInteractive(true);
                }
            }));
        }
        catch { textDialogPending = false; }
    }

    void HandleMouseDown(Point p)
    {
        if (!interactive) return;
        start = p;
        last = p;
        dragging = true;

        switch (mode)
        {
            case ToolMode.Pen:
                current = new StrokeShape(owner.InkColor, owner.InkWidth, p);
                shapes.Add(current);
                break;
            case ToolMode.Highlighter:
                current = new StrokeShape(Color.FromArgb(95, owner.InkColor), Math.Max(10, owner.InkWidth * 4), p);
                shapes.Add(current);
                break;
            case ToolMode.Line:
                current = new LineShape(owner.InkColor, owner.InkWidth, start, start, false);
                break;
            case ToolMode.Arrow:
                current = new LineShape(owner.InkColor, owner.InkWidth, start, start, true);
                break;
            case ToolMode.Rectangle:
                current = new RectShape(owner.InkColor, owner.InkWidth, RectFrom(start, start), false, owner.Filled);
                break;
            case ToolMode.Ellipse:
                current = new RectShape(owner.InkColor, owner.InkWidth, RectFrom(start, start), true, owner.Filled);
                break;
            case ToolMode.Eraser:
                EraseAt(p);
                break;
            case ToolMode.Select:
                selectionRect = Rectangle.Empty;
                oldSelectionRect = Rectangle.Empty;
                break;
            default:
                dragging = false;
                break;
        }
    }

    void HandleMouseMove(Point p)
    {
        if (!interactive || !dragging) return;
        var before = current?.Bounds ?? Rectangle.Empty;
        switch (mode)
        {
            case ToolMode.Pen:
            case ToolMode.Highlighter:
                if (current is StrokeShape s) s.Add(p);
                break;
            case ToolMode.Line:
            case ToolMode.Arrow:
                if (current is LineShape l) l.B = p;
                break;
            case ToolMode.Rectangle:
            case ToolMode.Ellipse:
                if (current is RectShape r) r.Rect = RectFrom(start, p);
                break;
            case ToolMode.Eraser:
                EraseAt(p);
                break;
            case ToolMode.Select:
                oldSelectionRect = selectionRect;
                selectionRect = RectFrom(start, p);
                var sr = Rectangle.Union(oldSelectionRect, selectionRect);
                sr.Inflate(4, 4);
                Invalidate(sr);
                last = p;
                return;
        }
        var after = current?.Bounds ?? Rectangle.Empty;
        var dirty = Rectangle.Union(before, after);
        dirty = Rectangle.Union(dirty, Rectangle.FromLTRB(Math.Min(last.X, p.X), Math.Min(last.Y, p.Y), Math.Max(last.X, p.X) + 1, Math.Max(last.Y, p.Y) + 1));
        dirty.Inflate(28, 28);
        Invalidate(dirty);
        last = p;
    }

    void HandleMouseUp(Point p)
    {
        if (!interactive || !dragging) return;
        dragging = false;

        if (mode == ToolMode.Select)
        {
            selectionRect = RectFrom(start, p);
            var screenRect = new Rectangle(new Point(selectionRect.X + Left, selectionRect.Y + Top), selectionRect.Size);
            selectionRect = Rectangle.Empty;
            Invalidate();
            owner.FinishSelection(screenRect);
            return;
        }

        if (current != null && mode is ToolMode.Line or ToolMode.Arrow or ToolMode.Rectangle or ToolMode.Ellipse)
        {
            if (current.Bounds.Width > 1 || current.Bounds.Height > 1) shapes.Add(current);
        }
        current = null;
        Invalidate();
    }

    void EraseAt(Point p)
    {
        for (int i = shapes.Count - 1; i >= 0; i--)
        {
            if (shapes[i].Hit(p, 12))
            {
                var b = shapes[i].Bounds;
                shapes.RemoveAt(i);
                b.Inflate(20, 20);
                Invalidate(b);
                break;
            }
        }
    }

    public void Undo()
    {
        if (shapes.Count == 0) return;
        var b = shapes[^1].Bounds;
        shapes.RemoveAt(shapes.Count - 1);
        b.Inflate(30, 30);
        Invalidate(b);
    }

    public void ClearAll()
    {
        shapes.Clear();
        current = null;
        selectionRect = Rectangle.Empty;
        Invalidate();
    }

    public void AddText(Point p, string text, Color color, float size)
    {
        shapes.Add(new TextShape(text, p, color, size));
        Invalidate();
    }

    public Rectangle GetPointerScreenBounds(Point cursor)
    {
        if (owner.CurrentPointer == PointerMode.Off || !Visible) return Rectangle.Empty;
        var r = owner.CurrentPointer == PointerMode.BigRing ? 52 : 42;
        if (owner.PulseActive) r += 34;
        return new Rectangle(cursor.X - r, cursor.Y - r, r * 2, r * 2);
    }

    public void InvalidateScreenRect(Rectangle screenRect)
    {
        if (screenRect.IsEmpty) return;
        var local = new Rectangle(screenRect.X - Left, screenRect.Y - Top, screenRect.Width, screenRect.Height);
        Invalidate(local);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        e.Graphics.CompositingQuality = CompositingQuality.HighSpeed;

        foreach (var s in shapes) s.Draw(e.Graphics);
        current?.Draw(e.Graphics);

        if (!selectionRect.IsEmpty)
        {
            using var fill = new SolidBrush(Color.FromArgb(35, 0, 120, 255));
            using var pen = new Pen(Color.DeepSkyBlue, 2) { DashStyle = DashStyle.Dash };
            e.Graphics.FillRectangle(fill, selectionRect);
            e.Graphics.DrawRectangle(pen, selectionRect);
        }

        DrawPointer(e.Graphics);
    }

    void DrawPointer(Graphics g)
    {
        var pm = owner.CurrentPointer;
        if (pm == PointerMode.Off) return;

        var sp = Cursor.Position;
        var p = new Point(sp.X - Left, sp.Y - Top);
        var accent = Color.FromArgb(0, 120, 255);
        using var pen = new Pen(accent, 3f) { StartCap = LineCap.Round, EndCap = LineCap.Round };

        switch (pm)
        {
            case PointerMode.Ring:
                g.DrawEllipse(pen, p.X - 22, p.Y - 22, 44, 44);
                break;
            case PointerMode.BigRing:
                g.DrawEllipse(pen, p.X - 34, p.Y - 34, 68, 68);
                break;
            case PointerMode.Pen:
                using (var body = new Pen(accent, 5f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                    g.DrawLine(body, p.X - 13, p.Y + 13, p.X + 11, p.Y - 11);
                using (var nib = new Pen(Color.White, 1.5f))
                    g.DrawLine(nib, p.X - 12, p.Y + 12, p.X - 7, p.Y + 7);
                break;
            case PointerMode.Hand:
                try { Cursors.Hand.Draw(g, new Rectangle(p.X - 7, p.Y - 6, 32, 32)); }
                catch { g.DrawEllipse(pen, p.X - 12, p.Y - 12, 24, 24); }
                break;
            case PointerMode.Target:
                g.DrawEllipse(pen, p.X - 18, p.Y - 18, 36, 36);
                g.DrawLine(pen, p.X - 30, p.Y, p.X - 6, p.Y);
                g.DrawLine(pen, p.X + 6, p.Y, p.X + 30, p.Y);
                g.DrawLine(pen, p.X, p.Y - 30, p.X, p.Y - 6);
                g.DrawLine(pen, p.X, p.Y + 6, p.X, p.Y + 30);
                using (var dot = new SolidBrush(accent)) g.FillEllipse(dot, p.X - 3, p.Y - 3, 6, 6);
                break;
        }

        if (owner.PulseActive)
        {
            var t = Math.Clamp(owner.PulseAge / 280f, 0, 1);
            var rr = 28 + (int)(34 * t);
            using var pulse = new Pen(Color.FromArgb((int)(190 * (1 - t)), accent), 3f);
            g.DrawEllipse(pulse, p.X - rr, p.Y - rr, rr * 2, rr * 2);
        }
    }

    static Rectangle RectFrom(Point a, Point b)
    {
        var x = Math.Min(a.X, b.X);
        var y = Math.Min(a.Y, b.Y);
        return new Rectangle(x, y, Math.Abs(a.X - b.X), Math.Abs(a.Y - b.Y));
    }
}

abstract class InkShape
{
    protected InkShape(Color color, float width) { Color = color; Width = width; }
    public Color Color { get; }
    public float Width { get; }
    public abstract Rectangle Bounds { get; }
    public abstract void Draw(Graphics g);
    public abstract bool Hit(Point p, float tolerance);
}

sealed class StrokeShape : InkShape
{
    readonly List<Point> points = new();
    public StrokeShape(Color c, float w, Point first) : base(c, w) { points.Add(first); }
    public void Add(Point p) { if (points.Count == 0 || Distance(points[^1], p) >= 1.2) points.Add(p); }

    public override Rectangle Bounds
    {
        get
        {
            if (points.Count == 0) return Rectangle.Empty;
            var minX = points.Min(p => p.X); var maxX = points.Max(p => p.X);
            var minY = points.Min(p => p.Y); var maxY = points.Max(p => p.Y);
            var r = Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
            r.Inflate((int)Width + 5, (int)Width + 5);
            return r;
        }
    }

    public override void Draw(Graphics g)
    {
        using var pen = new Pen(Color, Width) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        if (points.Count == 1) g.DrawEllipse(pen, points[0].X, points[0].Y, 1, 1);
        else g.DrawLines(pen, points.ToArray());
    }

    public override bool Hit(Point p, float tol)
    {
        if (!Bounds.Contains(p)) return false;
        for (int i = 1; i < points.Count; i++)
            if (DistToSegment(p, points[i - 1], points[i]) <= tol + Width / 2) return true;
        return points.Count == 1 && Distance(points[0], p) <= tol + Width;
    }

    static double Distance(Point a, Point b) => Math.Sqrt((a.X - b.X) * (double)(a.X - b.X) + (a.Y - b.Y) * (double)(a.Y - b.Y));

    static double DistToSegment(Point p, Point a, Point b)
    {
        double dx = b.X - a.X, dy = b.Y - a.Y;
        if (dx == 0 && dy == 0) return Distance(p, a);
        var t = ((p.X - a.X) * dx + (p.Y - a.Y) * dy) / (dx * dx + dy * dy);
        t = Math.Max(0, Math.Min(1, t));
        var x = a.X + t * dx; var y = a.Y + t * dy;
        return Math.Sqrt((p.X - x) * (p.X - x) + (p.Y - y) * (p.Y - y));
    }
}

sealed class LineShape : InkShape
{
    public Point A { get; }
    public Point B { get; set; }
    readonly bool arrow;

    public LineShape(Color c, float w, Point a, Point b, bool arrow) : base(c, w)
    {
        A = a; B = b; this.arrow = arrow;
    }

    public override Rectangle Bounds
    {
        get
        {
            var r = Rectangle.FromLTRB(Math.Min(A.X, B.X), Math.Min(A.Y, B.Y), Math.Max(A.X, B.X) + 1, Math.Max(A.Y, B.Y) + 1);
            r.Inflate(30, 30);
            return r;
        }
    }

    public override void Draw(Graphics g)
    {
        using var p = new Pen(Color, Width) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        if (arrow) p.CustomEndCap = new AdjustableArrowCap(Math.Max(4, Width * 2.5f), Math.Max(5, Width * 3f), true);
        g.DrawLine(p, A, B);
    }

    public override bool Hit(Point p, float tol)
    {
        var s = new StrokeShape(Color, Width, A);
        s.Add(B);
        return s.Hit(p, tol);
    }
}

sealed class RectShape : InkShape
{
    public Rectangle Rect { get; set; }
    readonly bool ellipse;
    readonly bool fill;

    public RectShape(Color c, float w, Rectangle r, bool ellipse, bool fill) : base(c, w)
    {
        Rect = r; this.ellipse = ellipse; this.fill = fill;
    }

    public override Rectangle Bounds
    {
        get
        {
            var r = Rect;
            r.Inflate((int)Width + 4, (int)Width + 4);
            return r;
        }
    }

    public override void Draw(Graphics g)
    {
        if (Rect.Width < 1 || Rect.Height < 1) return;
        if (fill)
        {
            using var b = new SolidBrush(Color.FromArgb(Math.Min(220, (int)Color.A), Color));
            if (ellipse) g.FillEllipse(b, Rect); else g.FillRectangle(b, Rect);
        }
        using var p = new Pen(Color, Width);
        if (ellipse) g.DrawEllipse(p, Rect); else g.DrawRectangle(p, Rect);
    }

    public override bool Hit(Point p, float tol)
    {
        if (fill) return Rect.Contains(p);
        var outer = Rect; outer.Inflate((int)(tol + Width), (int)(tol + Width));
        var inner = Rect; inner.Inflate(-(int)(tol + Width), -(int)(tol + Width));
        return outer.Contains(p) && (!inner.Contains(p) || inner.Width <= 0 || inner.Height <= 0);
    }
}

sealed class TextShape : InkShape
{
    readonly string text;
    readonly Point at;
    readonly float size;
    readonly Rectangle cached;

    public TextShape(string text, Point at, Color c, float size) : base(c, 1)
    {
        this.text = text;
        this.at = at;
        this.size = size;
        cached = new Rectangle(at, new Size(Math.Max(20, text.Length * (int)(size * .65f)), (int)(size * 1.8f)));
    }

    public override Rectangle Bounds => cached;

    public override void Draw(Graphics g)
    {
        using var font = new Font(SystemFonts.MessageBoxFont.FontFamily, size, FontStyle.Bold, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(Color);
        g.DrawString(text, font, brush, at);
    }

    public override bool Hit(Point p, float tol)
    {
        var r = cached;
        r.Inflate((int)tol, (int)tol);
        return r.Contains(p);
    }
}

sealed class TextEntryForm : Form
{
    readonly TextBox box;
    public string Value => box.Text;

    public TextEntryForm(Color color)
    {
        Text = "Texto";
        Width = 330;
        Height = 125;
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        TopMost = true;
        box = new TextBox { Left = 10, Top = 10, Width = 295, Height = 28, Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 12), ForeColor = color };
        var ok = new Button { Text = "Inserir", Left = 145, Top = 48, Width = 78, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancelar", Left = 227, Top = 48, Width = 78, DialogResult = DialogResult.Cancel };
        Controls.Add(box); Controls.Add(ok); Controls.Add(cancel);
        AcceptButton = ok; CancelButton = cancel;
        Shown += (_, _) => box.Focus();
    }
}

static class Native
{
    public const int WM_HOTKEY = 0x0312;
    public const int WH_MOUSE_LL = 14;
    public const int WM_MOUSEMOVE = 0x0200;
    public const int WM_LBUTTONDOWN = 0x0201;
    public const int WM_LBUTTONUP = 0x0202;
    public const int WM_RBUTTONDOWN = 0x0204;
    public const int WM_RBUTTONUP = 0x0205;

    public const uint MOD_ALT = 0x0001;
    public const uint MOD_CONTROL = 0x0002;
    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_TRANSPARENT = 0x20;
    public const int WS_EX_TOOLWINDOW = 0x80;
    public const int WS_EX_NOACTIVATE = 0x08000000;
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOZORDER = 0x0004;
    public const uint SWP_NOACTIVATE = 0x0010;
    public const uint SWP_FRAMECHANGED = 0x0020;

    public delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSLLHOOKSTRUCT
    {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }

    [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll", SetLastError = true)] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll", SetLastError = true)] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")] public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] public static extern IntPtr GetModuleHandle(string? lpModuleName);
}
