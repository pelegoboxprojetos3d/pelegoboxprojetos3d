using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace PelegoMarkerV31;

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

enum ToolMode { Mouse, Pen, Highlighter, Line, Arrow, Rectangle, Ellipse, Eraser }
enum PointerMode { Off, Ring, BigRing, Pen, Hand, Target }
enum GlyphKind { Mouse, Pen, Highlighter, Line, Arrow, Rectangle, Ellipse, Eraser, Undo, Clear, Minus, Plus, PointerOff, Ring, BigRing, PointerPen, Hand, Target }

sealed class MainForm : Form
{
    const int LauncherWidth = 58;
    const int LauncherHeight = 58;
    const int PaletteWidth = 58;
    const int PaletteHeight = 663;
    const int HOTKEY_PANIC = 4100;

    readonly CanvasForm canvas;
    readonly ToolTip tips = new();
    readonly Dictionary<ToolMode, GlyphButton> toolButtons = new();
    readonly Dictionary<PointerMode, GlyphButton> pointerButtons = new();
    readonly List<GlyphButton> colorButtons = new();

    bool expanded;
    bool allowExit;
    Point dragStartMouse;
    Point dragStartWindow;
    bool draggingWindow;
    int inkWidth = 4;
    Color inkColor = Color.FromArgb(0, 120, 255);
    ToolMode toolMode = ToolMode.Mouse;
    PointerMode pointerMode = PointerMode.Off;
    Label? status;
    Label? widthLabel;

    public Color InkColor => inkColor;
    public float InkWidth => inkWidth;
    public ToolMode CurrentTool => toolMode;
    public PointerMode CurrentPointer => pointerMode;

    public MainForm(bool startMinimized)
    {
        Text = "PELEGO Marcador de Tela 3.1";
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = true;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        BackColor = Color.FromArgb(238, 238, 238);
        KeyPreview = true;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        ClientSize = new Size(LauncherWidth, LauncherHeight);
        LoadLocation();
        canvas = new CanvasForm(this);
        BuildLauncher();

        FormClosing += (_, e) =>
        {
            if (allowExit) return;
            e.Cancel = true;
            ExitApp();
        };
        Move += (_, _) => SaveLocation();
        Shown += (_, _) =>
        {
            RegisterPanicHotkey();
            canvas.Hide();
            BringToFront();
            if (startMinimized) WindowState = FormWindowState.Minimized;
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
        Controls.Clear();
        ClientSize = new Size(LauncherWidth, LauncherHeight);
        Controls.Add(CreateHeader("Poi..."));

        var start = new Button
        {
            Text = "Start",
            Left = 3,
            Top = 27,
            Width = 52,
            Height = 27,
            FlatStyle = FlatStyle.System,
            TabStop = false
        };
        start.Click += (_, _) => ExpandPalette();
        Controls.Add(start);
        tips.SetToolTip(start, "Abrir a paleta aqui");
    }

    void ExpandPalette()
    {
        var here = Location;
        expanded = true;
        Controls.Clear();
        toolButtons.Clear();
        pointerButtons.Clear();
        colorButtons.Clear();
        ClientSize = new Size(PaletteWidth, Math.Min(PaletteHeight, Math.Max(520, Screen.FromPoint(here).WorkingArea.Height - 12)));
        Location = ClampLocation(here, ClientSize);
        Controls.Add(CreateHeader("PE"));

        status = new Label
        {
            Left = 3,
            Top = 23,
            Width = 52,
            Height = 20,
            Text = "CANETA",
            TextAlign = ContentAlignment.MiddleCenter,
            BorderStyle = BorderStyle.FixedSingle,
            BackColor = Color.White,
            Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 7f, FontStyle.Bold)
        };
        Controls.Add(status);

        var y = 47;
        AddPointerPair(ref y, PointerMode.Ring, GlyphKind.Ring, "Círculo", PointerMode.BigRing, GlyphKind.BigRing, "Círculo grande");
        AddPointerPair(ref y, PointerMode.Pen, GlyphKind.PointerPen, "Ponteiro caneta", PointerMode.Hand, GlyphKind.Hand, "Mão");
        AddPointerPair(ref y, PointerMode.Target, GlyphKind.Target, "Alvo", PointerMode.Off, GlyphKind.PointerOff, "Ponteiro normal");
        Gap(ref y);

        AddColorPair(ref y, Color.FromArgb(255, 60, 60), Color.Gold);
        AddColorPair(ref y, Color.LimeGreen, Color.FromArgb(0, 120, 255));
        AddColorPair(ref y, Color.FromArgb(255, 120, 0), Color.DeepSkyBlue);
        AddColorPair(ref y, Color.White, Color.Black);
        Gap(ref y);

        AddToolPair(ref y, ToolMode.Pen, GlyphKind.Pen, "Caneta", ToolMode.Highlighter, GlyphKind.Highlighter, "Marca-texto");
        AddToolPair(ref y, ToolMode.Line, GlyphKind.Line, "Linha", ToolMode.Arrow, GlyphKind.Arrow, "Seta");
        AddToolPair(ref y, ToolMode.Rectangle, GlyphKind.Rectangle, "Retângulo", ToolMode.Ellipse, GlyphKind.Ellipse, "Elipse");
        AddToolPair(ref y, ToolMode.Eraser, GlyphKind.Eraser, "Borracha", ToolMode.Mouse, GlyphKind.Mouse, "Mouse / vídeo");
        Gap(ref y);

        AddActionPair(ref y,
            MakeAction(GlyphKind.Undo, "Desfazer", canvas.Undo),
            MakeAction(GlyphKind.Clear, "Limpar", canvas.ClearAll));
        AddActionPair(ref y,
            MakeAction(GlyphKind.Minus, "Traço mais fino", () => ChangeWidth(-1)),
            MakeAction(GlyphKind.Plus, "Traço mais grosso", () => ChangeWidth(+1)));

        widthLabel = new Label
        {
            Left = 3,
            Top = y + 3,
            Width = 52,
            Height = 18,
            Text = $"TRAÇO {inkWidth}",
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 7f)
        };
        Controls.Add(widthLabel);

        toolMode = ToolMode.Pen;
        pointerMode = PointerMode.Off;
        UpdateButtons();

        if (!canvas.Visible) canvas.Show();
        canvas.SetMode(ToolMode.Pen);
        canvas.SetInteractive(true);
        canvas.Invalidate();
        BringToFront();
        Activate();
    }

    Panel CreateHeader(string title)
    {
        var p = new Panel { Left = 0, Top = 0, Width = ClientSize.Width, Height = 21, BackColor = Color.FromArgb(238, 238, 238) };
        var label = new Label
        {
            Text = title,
            Left = 3,
            Top = 1,
            Width = 31,
            Height = 18,
            TextAlign = ContentAlignment.MiddleLeft,
            Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 7.5f)
        };
        var close = new Button
        {
            Text = "×",
            Left = ClientSize.Width - 21,
            Top = 1,
            Width = 19,
            Height = 18,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(205, 70, 70),
            ForeColor = Color.White,
            TabStop = false
        };
        close.FlatAppearance.BorderSize = 0;
        close.Click += (_, _) => ExitApp();
        AttachDrag(p);
        AttachDrag(label);
        p.Controls.Add(label);
        p.Controls.Add(close);
        return p;
    }

    void AttachDrag(Control c)
    {
        c.MouseDown += (_, e) =>
        {
            if (e.Button != MouseButtons.Left) return;
            draggingWindow = true;
            dragStartMouse = Cursor.Position;
            dragStartWindow = Location;
        };
        c.MouseMove += (_, _) =>
        {
            if (!draggingWindow || (Control.MouseButtons & MouseButtons.Left) == 0) return;
            var now = Cursor.Position;
            Location = new Point(dragStartWindow.X + now.X - dragStartMouse.X, dragStartWindow.Y + now.Y - dragStartMouse.Y);
        };
        c.MouseUp += (_, _) => draggingWindow = false;
    }

    void Gap(ref int y)
    {
        Controls.Add(new Panel { Left = 4, Top = y + 2, Width = 50, Height = 1, BackColor = Color.FromArgb(175, 175, 175) });
        y += 10;
    }

    void AddToolPair(ref int y, ToolMode aMode, GlyphKind aGlyph, string aTip, ToolMode bMode, GlyphKind bGlyph, string bTip)
    {
        var a = new GlyphButton(aGlyph); a.Click += (_, _) => SetTool(aMode); toolButtons[aMode] = a; tips.SetToolTip(a, aTip);
        var b = new GlyphButton(bGlyph); b.Click += (_, _) => SetTool(bMode); toolButtons[bMode] = b; tips.SetToolTip(b, bTip);
        PlacePair(a, b, y); y += 25;
    }

    void AddPointerPair(ref int y, PointerMode aMode, GlyphKind aGlyph, string aTip, PointerMode bMode, GlyphKind bGlyph, string bTip)
    {
        var a = new GlyphButton(aGlyph); a.Click += (_, _) => SetPointer(aMode); pointerButtons[aMode] = a; tips.SetToolTip(a, aTip);
        var b = new GlyphButton(bGlyph); b.Click += (_, _) => SetPointer(bMode); pointerButtons[bMode] = b; tips.SetToolTip(b, bTip);
        PlacePair(a, b, y); y += 25;
    }

    void AddColorPair(ref int y, Color aColor, Color bColor)
    {
        var a = MakeColor(aColor);
        var b = MakeColor(bColor);
        PlacePair(a, b, y); y += 25;
    }

    void AddActionPair(ref int y, Control a, Control b)
    {
        PlacePair(a, b, y); y += 25;
    }

    void PlacePair(Control a, Control b, int y)
    {
        a.SetBounds(4, y, 23, 23);
        b.SetBounds(31, y, 23, 23);
        Controls.Add(a);
        Controls.Add(b);
    }

    GlyphButton MakeAction(GlyphKind glyph, string tip, Action action)
    {
        var b = new GlyphButton(glyph);
        b.Click += (_, _) => action();
        tips.SetToolTip(b, tip);
        return b;
    }

    GlyphButton MakeColor(Color c)
    {
        var b = new GlyphButton(GlyphKind.Rectangle) { Swatch = c };
        b.Click += (_, _) =>
        {
            inkColor = c;
            foreach (var x in colorButtons) x.Selected = ReferenceEquals(x, b);
        };
        colorButtons.Add(b);
        if (colorButtons.Count == 1) b.Selected = true;
        return b;
    }

    void SetTool(ToolMode mode)
    {
        if (!expanded) return;
        toolMode = mode;
        canvas.SetMode(mode);
        canvas.SetInteractive(mode != ToolMode.Mouse);
        if (status != null) status.Text = mode switch
        {
            ToolMode.Pen => "CANETA",
            ToolMode.Highlighter => "MARCA",
            ToolMode.Line => "LINHA",
            ToolMode.Arrow => "SETA",
            ToolMode.Rectangle => "RET",
            ToolMode.Ellipse => "ELIPSE",
            ToolMode.Eraser => "BORRA",
            _ => "MOUSE"
        };
        UpdateButtons();
        BringToFront();
    }

    void SetPointer(PointerMode mode)
    {
        if (!expanded) return;
        pointerMode = mode;
        if (!canvas.Visible) canvas.Show();
        UpdateButtons();
        canvas.Invalidate();
        BringToFront();
    }

    void ChangeWidth(int d)
    {
        inkWidth = Math.Clamp(inkWidth + d, 1, 18);
        if (widthLabel != null) widthLabel.Text = $"TRAÇO {inkWidth}";
    }

    void UpdateButtons()
    {
        foreach (var kv in toolButtons) kv.Value.Selected = kv.Key == toolMode;
        foreach (var kv in pointerButtons) kv.Value.Selected = kv.Key == pointerMode;
    }

    public bool IsToolbarPoint(Point p) => Visible && WindowState == FormWindowState.Normal && Bounds.Contains(p);

    public void ReleaseDrawingOnly()
    {
        toolMode = ToolMode.Mouse;
        canvas.SetMode(ToolMode.Mouse);
        canvas.SetInteractive(false);
        if (status != null) status.Text = "MOUSE";
        UpdateButtons();
        BringToFront();
    }

    void PanicRelease()
    {
        ReleaseDrawingOnly();
        pointerMode = PointerMode.Off;
        UpdateButtons();
        canvas.Invalidate();
    }

    void ExitApp()
    {
        allowExit = true;
        try { canvas.SetInteractive(false); canvas.Close(); } catch { }
        if (IsHandleCreated) Native.UnregisterHotKey(Handle, HOTKEY_PANIC);
        Application.Exit();
    }

    void RegisterPanicHotkey()
    {
        Native.UnregisterHotKey(Handle, HOTKEY_PANIC);
        Native.RegisterHotKey(Handle, HOTKEY_PANIC, Native.MOD_CONTROL | Native.MOD_ALT, (uint)Keys.F12);
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

    void LoadLocation()
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

    Point ClampLocation(Point p, Size s)
    {
        var wa = Screen.FromPoint(p).WorkingArea;
        return new Point(Math.Clamp(p.X, wa.Left, Math.Max(wa.Left, wa.Right - s.Width)), Math.Clamp(p.Y, wa.Top, Math.Max(wa.Top, wa.Bottom - s.Height)));
    }
}

sealed class GlyphButton : Button
{
    public GlyphKind Glyph { get; }
    public Color? Swatch { get; set; }
    bool selected;
    public bool Selected { get => selected; set { selected = value; Invalidate(); } }

    public GlyphButton(GlyphKind glyph)
    {
        Glyph = glyph;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        BackColor = Color.FromArgb(244, 244, 244);
        TabStop = false;
        Margin = Padding.Empty;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Selected ? Color.FromArgb(205, 229, 255) : BackColor);
        using (var border = new Pen(Selected ? Color.FromArgb(0, 90, 220) : Color.FromArgb(175, 175, 175), Selected ? 2f : 1f))
            g.DrawRectangle(border, 0, 0, Width - 1, Height - 1);

        var r = new Rectangle(4, 4, Math.Max(1, Width - 8), Math.Max(1, Height - 8));
        if (Swatch.HasValue)
        {
            using var b = new SolidBrush(Swatch.Value);
            g.FillRectangle(b, r);
            using var p = new Pen(Swatch.Value == Color.White ? Color.Gray : Color.FromArgb(110, 110, 110));
            g.DrawRectangle(p, r);
            return;
        }
        DrawGlyph(g, r, Glyph);
    }

    static void DrawGlyph(Graphics g, Rectangle r, GlyphKind k)
    {
        var c = Color.FromArgb(35, 35, 35);
        using var p = new Pen(c, 1.5f) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        using var thin = new Pen(c, 1f);
        using var fill = new SolidBrush(c);
        var cx = r.Left + r.Width / 2f;
        var cy = r.Top + r.Height / 2f;

        switch (k)
        {
            case GlyphKind.Mouse:
                g.DrawLines(p, new[] { new PointF(r.Left + 2, r.Top + 1), new PointF(r.Left + 2, r.Bottom - 2), new PointF(r.Left + 7, r.Bottom - 6), new PointF(r.Left + 11, r.Bottom - 1), new PointF(r.Left + 13, r.Bottom - 3), new PointF(r.Left + 9, r.Bottom - 8) });
                break;
            case GlyphKind.Pen:
            case GlyphKind.PointerPen:
                g.DrawLine(p, r.Left + 2, r.Bottom - 2, r.Right - 3, r.Top + 3);
                g.DrawLine(p, r.Right - 5, r.Top + 2, r.Right - 1, r.Top + 6);
                break;
            case GlyphKind.Highlighter:
                using (var hp = new Pen(c, 4f)) g.DrawLine(hp, r.Left + 3, r.Bottom - 4, r.Right - 3, r.Top + 4);
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
                g.DrawRectangle(thin, r.Left + 1, r.Top + 3, r.Width - 3, r.Height - 6);
                break;
            case GlyphKind.Ellipse:
                g.DrawEllipse(thin, r.Left + 1, r.Top + 3, r.Width - 3, r.Height - 6);
                break;
            case GlyphKind.Eraser:
                g.DrawPolygon(p, new[] { new PointF(r.Left + 2, r.Bottom - 5), new PointF(r.Left + 7, r.Top + 2), new PointF(r.Right - 2, r.Top + 7), new PointF(r.Right - 7, r.Bottom - 1) });
                break;
            case GlyphKind.Undo:
                g.DrawArc(p, r.Left + 3, r.Top + 3, r.Width - 5, r.Height - 6, 200, 250);
                g.DrawLine(p, r.Left + 2, cy, r.Left + 7, cy - 4);
                break;
            case GlyphKind.Clear:
                g.DrawRectangle(thin, r.Left + 4, r.Top + 5, r.Width - 8, r.Height - 7);
                g.DrawLine(p, r.Left + 3, r.Top + 4, r.Right - 3, r.Top + 4);
                break;
            case GlyphKind.Minus:
                g.DrawLine(p, r.Left + 3, cy, r.Right - 3, cy);
                break;
            case GlyphKind.Plus:
                g.DrawLine(p, r.Left + 3, cy, r.Right - 3, cy);
                g.DrawLine(p, cx, r.Top + 3, cx, r.Bottom - 3);
                break;
            case GlyphKind.PointerOff:
                g.DrawEllipse(thin, r.Left + 2, r.Top + 2, r.Width - 4, r.Height - 4);
                g.DrawLine(p, r.Left + 3, r.Bottom - 3, r.Right - 3, r.Top + 3);
                break;
            case GlyphKind.Ring:
                g.DrawEllipse(p, r.Left + 3, r.Top + 3, r.Width - 6, r.Height - 6);
                break;
            case GlyphKind.BigRing:
                g.DrawEllipse(p, r.Left + 1, r.Top + 1, r.Width - 2, r.Height - 2);
                break;
            case GlyphKind.Hand:
                g.DrawLine(p, cx, r.Bottom - 2, cx, r.Top + 2);
                g.DrawLine(p, cx, r.Top + 2, cx + 3, r.Top + 1);
                g.DrawLine(p, cx + 3, r.Top + 1, cx + 5, r.Bottom - 5);
                g.DrawArc(p, r.Left + 2, (int)cy, r.Width - 4, r.Height / 2, 0, 180);
                break;
            case GlyphKind.Target:
                g.DrawEllipse(thin, r.Left + 3, r.Top + 3, r.Width - 6, r.Height - 6);
                g.DrawLine(thin, cx, r.Top, cx, r.Bottom);
                g.DrawLine(thin, r.Left, cy, r.Right, cy);
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
    IntPtr mouseHook;
    ToolMode mode = ToolMode.Mouse;
    InkShape? current;
    Point start;
    Point last;
    bool dragging;
    bool interactive;

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
        UninstallHook();
        base.OnHandleDestroyed(e);
    }

    public void SetMode(ToolMode m)
    {
        mode = m;
        dragging = false;
        current = null;
    }

    public void SetInteractive(bool value)
    {
        interactive = value;
        if (value) InstallHook();
        else
        {
            dragging = false;
            current = null;
            UninstallHook();
        }
    }

    void InstallHook()
    {
        if (!interactive || mouseHook != IntPtr.Zero || !IsHandleCreated) return;
        try
        {
            using var process = Process.GetCurrentProcess();
            var module = Native.GetModuleHandle(process.MainModule?.ModuleName);
            mouseHook = Native.SetWindowsHookEx(Native.WH_MOUSE_LL, mouseProc, module, 0);
        }
        catch { mouseHook = IntPtr.Zero; }
    }

    void UninstallHook()
    {
        if (mouseHook == IntPtr.Zero) return;
        try { Native.UnhookWindowsHookEx(mouseHook); } catch { }
        mouseHook = IntPtr.Zero;
    }

    IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode < 0 || !interactive)
            return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);

        var d = Marshal.PtrToStructure<Native.MSLLHOOKSTRUCT>(lParam);
        var screen = new Point(d.pt.X, d.pt.Y);
        if (owner.IsToolbarPoint(screen))
            return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);

        var msg = wParam.ToInt32();
        var p = new Point(screen.X - Left, screen.Y - Top);

        if (msg == Native.WM_RBUTTONDOWN)
        {
            try { BeginInvoke(new Action(owner.ReleaseDrawingOnly)); } catch { }
            return (IntPtr)1;
        }

        if (msg == Native.WM_LBUTTONDOWN)
        {
            HandleDown(p);
            return (IntPtr)1;
        }

        if (msg == Native.WM_MOUSEMOVE && dragging)
        {
            HandleMove(p);
            // Fundamental para vídeo: o movimento continua no Windows.
            return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);
        }

        if (msg == Native.WM_LBUTTONUP && dragging)
        {
            HandleUp(p);
            return (IntPtr)1;
        }

        return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);
    }

    void HandleDown(Point p)
    {
        start = last = p;
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
                current = new LineShape(owner.InkColor, owner.InkWidth, p, p, false);
                break;
            case ToolMode.Arrow:
                current = new LineShape(owner.InkColor, owner.InkWidth, p, p, true);
                break;
            case ToolMode.Rectangle:
                current = new RectShape(owner.InkColor, owner.InkWidth, RectFrom(p, p), false);
                break;
            case ToolMode.Ellipse:
                current = new RectShape(owner.InkColor, owner.InkWidth, RectFrom(p, p), true);
                break;
            case ToolMode.Eraser:
                EraseAt(p);
                break;
            default:
                dragging = false;
                break;
        }
    }

    void HandleMove(Point p)
    {
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
        }
        var after = current?.Bounds ?? Rectangle.Empty;
        var dirty = Rectangle.Union(before, after);
        dirty = Rectangle.Union(dirty, Rectangle.FromLTRB(Math.Min(last.X, p.X), Math.Min(last.Y, p.Y), Math.Max(last.X, p.X) + 1, Math.Max(last.Y, p.Y) + 1));
        dirty.Inflate(24, 24);
        Invalidate(dirty);
        last = p;
    }

    void HandleUp(Point p)
    {
        dragging = false;
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
            if (!shapes[i].Hit(p, 12)) continue;
            var b = shapes[i].Bounds;
            shapes.RemoveAt(i);
            b.Inflate(18, 18);
            Invalidate(b);
            return;
        }
    }

    public void Undo()
    {
        if (shapes.Count == 0) return;
        var b = shapes[^1].Bounds;
        shapes.RemoveAt(shapes.Count - 1);
        b.Inflate(25, 25);
        Invalidate(b);
    }

    public void ClearAll()
    {
        shapes.Clear();
        current = null;
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        foreach (var s in shapes) s.Draw(e.Graphics);
        current?.Draw(e.Graphics);
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
                using (var body = new Pen(accent, 5f)) g.DrawLine(body, p.X - 13, p.Y + 13, p.X + 11, p.Y - 11);
                break;
            case PointerMode.Hand:
                try { Cursors.Hand.Draw(g, new Rectangle(p.X - 6, p.Y - 5, 32, 32)); } catch { }
                break;
            case PointerMode.Target:
                g.DrawEllipse(pen, p.X - 18, p.Y - 18, 36, 36);
                g.DrawLine(pen, p.X - 30, p.Y, p.X - 6, p.Y);
                g.DrawLine(pen, p.X + 6, p.Y, p.X + 30, p.Y);
                g.DrawLine(pen, p.X, p.Y - 30, p.X, p.Y - 6);
                g.DrawLine(pen, p.X, p.Y + 6, p.X, p.Y + 30);
                break;
        }
    }

    static Rectangle RectFrom(Point a, Point b) => new(Math.Min(a.X, b.X), Math.Min(a.Y, b.Y), Math.Abs(a.X - b.X), Math.Abs(a.Y - b.Y));
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
    public StrokeShape(Color c, float w, Point first) : base(c, w) => points.Add(first);
    public void Add(Point p) { if (points.Count == 0 || Dist(points[^1], p) > 1.0) points.Add(p); }

    public override Rectangle Bounds
    {
        get
        {
            var minX = points.Min(x => x.X); var maxX = points.Max(x => x.X);
            var minY = points.Min(x => x.Y); var maxY = points.Max(x => x.Y);
            var r = Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
            r.Inflate((int)Width + 5, (int)Width + 5);
            return r;
        }
    }

    public override void Draw(Graphics g)
    {
        using var p = new Pen(Color, Width) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        if (points.Count == 1) g.DrawEllipse(p, points[0].X, points[0].Y, 1, 1);
        else g.DrawLines(p, points.ToArray());
    }

    public override bool Hit(Point p, float t)
    {
        if (!Bounds.Contains(p)) return false;
        for (int i = 1; i < points.Count; i++) if (SegmentDistance(p, points[i - 1], points[i]) <= t + Width / 2) return true;
        return points.Count == 1 && Dist(points[0], p) <= t + Width;
    }

    static double Dist(Point a, Point b) => Math.Sqrt(Math.Pow(a.X - b.X, 2) + Math.Pow(a.Y - b.Y, 2));
    static double SegmentDistance(Point p, Point a, Point b)
    {
        double dx = b.X - a.X, dy = b.Y - a.Y;
        if (dx == 0 && dy == 0) return Dist(p, a);
        var t = Math.Clamp(((p.X - a.X) * dx + (p.Y - a.Y) * dy) / (dx * dx + dy * dy), 0, 1);
        var x = a.X + t * dx; var y = a.Y + t * dy;
        return Math.Sqrt(Math.Pow(p.X - x, 2) + Math.Pow(p.Y - y, 2));
    }
}

sealed class LineShape : InkShape
{
    public Point A { get; }
    public Point B { get; set; }
    readonly bool arrow;
    public LineShape(Color c, float w, Point a, Point b, bool arrow) : base(c, w) { A = a; B = b; this.arrow = arrow; }
    public override Rectangle Bounds { get { var r = Rectangle.FromLTRB(Math.Min(A.X, B.X), Math.Min(A.Y, B.Y), Math.Max(A.X, B.X) + 1, Math.Max(A.Y, B.Y) + 1); r.Inflate(28, 28); return r; } }
    public override void Draw(Graphics g)
    {
        using var p = new Pen(Color, Width) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        if (arrow) p.CustomEndCap = new AdjustableArrowCap(Math.Max(4, Width * 2.5f), Math.Max(5, Width * 3f), true);
        g.DrawLine(p, A, B);
    }
    public override bool Hit(Point p, float t) { var s = new StrokeShape(Color, Width, A); s.Add(B); return s.Hit(p, t); }
}

sealed class RectShape : InkShape
{
    public Rectangle Rect { get; set; }
    readonly bool ellipse;
    public RectShape(Color c, float w, Rectangle r, bool ellipse) : base(c, w) { Rect = r; this.ellipse = ellipse; }
    public override Rectangle Bounds { get { var r = Rect; r.Inflate((int)Width + 5, (int)Width + 5); return r; } }
    public override void Draw(Graphics g)
    {
        if (Rect.Width < 1 || Rect.Height < 1) return;
        using var p = new Pen(Color, Width);
        if (ellipse) g.DrawEllipse(p, Rect); else g.DrawRectangle(p, Rect);
    }
    public override bool Hit(Point p, float t)
    {
        var outer = Rect; outer.Inflate((int)(t + Width), (int)(t + Width));
        var inner = Rect; inner.Inflate(-(int)(t + Width), -(int)(t + Width));
        return outer.Contains(p) && (!inner.Contains(p) || inner.Width <= 0 || inner.Height <= 0);
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
    public const uint MOD_ALT = 0x0001;
    public const uint MOD_CONTROL = 0x0002;
    public const int WS_EX_TRANSPARENT = 0x20;
    public const int WS_EX_TOOLWINDOW = 0x80;
    public const int WS_EX_NOACTIVATE = 0x08000000;

    public delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] public struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData; public uint flags; public uint time; public UIntPtr dwExtraInfo; }

    [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")] public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] public static extern IntPtr GetModuleHandle(string? lpModuleName);
}
