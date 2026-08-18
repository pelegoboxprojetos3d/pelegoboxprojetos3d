using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace PelegoMarkerV2;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        using var mutex = new Mutex(true, "PELEGO_MARCADOR_DE_TELA_V28_SINGLE", out var first);
        if (!first) return;

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        var startup = args.Any(a => a.Equals("/startup", StringComparison.OrdinalIgnoreCase));
        Application.Run(new MainForm(startup));
    }
}

enum ToolMode { Mouse, Pen, Highlighter, Line, Arrow, Rectangle, Ellipse, Text, Eraser, Select }
enum PointerMode { Off, Ring, BigRing, Target, Hand, Cross }

sealed class MainForm : Form
{
    const int HOTKEY_F8 = 2001;
    const int HOTKEY_F9 = 2002;
    const int HOTKEY_F7 = 2003;
    const int HOTKEY_F1 = 2011;
    const int HOTKEY_F2 = 2012;
    const int HOTKEY_F3 = 2013;
    const int HOTKEY_F4 = 2014;
    const int HOTKEY_F5 = 2015;
    const int HOTKEY_F6 = 2016;
    const int HOTKEY_PANIC = 2020;

    readonly CanvasForm canvas;
    readonly Timer uiTimer;
    readonly Label status;
    readonly NumericUpDown thickness;
    readonly CheckBox filled;
    readonly Dictionary<ToolMode, Button> toolButtons = new();
    readonly Dictionary<PointerMode, Button> pointerButtons = new();
    readonly List<Button> colorButtons = new();

    bool startup;
    bool allowRealExit;
    bool leftWasDown;
    long pulseStarted;
    PointerMode pointerMode = PointerMode.Ring;
    ToolMode toolMode = ToolMode.Mouse;
    Color inkColor = Color.FromArgb(0, 120, 255);
    Rectangle oldHaloRect = Rectangle.Empty;
    Bitmap? selectionSnapshot;

    public Color InkColor => inkColor;
    public float InkWidth => (float)thickness.Value;
    public bool Filled => filled.Checked;
    public ToolMode CurrentTool => toolMode;
    public PointerMode CurrentPointer => pointerMode;
    public bool PulseActive => Environment.TickCount64 - pulseStarted < 300;
    public long PulseAge => Environment.TickCount64 - pulseStarted;

    public MainForm(bool startMinimized)
    {
        startup = startMinimized;
        Text = "PELEGO Marcador de Tela";
        Width = 220;
        Height = 690;
        MinimumSize = new Size(220, 520);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        MinimizeBox = true;
        ShowInTaskbar = true;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        KeyPreview = true;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        LoadSavedLocation();
        canvas = new CanvasForm(this);

        var root = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoScroll = true,
            Padding = new Padding(8),
            BackColor = Color.FromArgb(245, 245, 247)
        };
        Controls.Add(root);

        var title = new Label
        {
            Text = "PELEGO  •  MARCADOR",
            AutoSize = false,
            Width = 185,
            Height = 28,
            TextAlign = ContentAlignment.MiddleLeft,
            Font = new Font(Font.FontFamily, 9.5f, FontStyle.Bold)
        };
        root.Controls.Add(title);

        status = new Label
        {
            Text = "MOUSE LIVRE",
            AutoSize = false,
            Width = 185,
            Height = 25,
            TextAlign = ContentAlignment.MiddleCenter,
            BackColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle
        };
        root.Controls.Add(status);

        root.Controls.Add(Section("FERRAMENTAS"));
        AddTool(root, "Mouse / Windows", ToolMode.Mouse);
        AddTool(root, "Caneta", ToolMode.Pen);
        AddTool(root, "Marca-texto", ToolMode.Highlighter);
        AddTool(root, "Linha", ToolMode.Line);
        AddTool(root, "Seta", ToolMode.Arrow);
        AddTool(root, "Retângulo", ToolMode.Rectangle);
        AddTool(root, "Elipse", ToolMode.Ellipse);
        AddTool(root, "Texto", ToolMode.Text);
        AddTool(root, "Borracha", ToolMode.Eraser);
        AddTool(root, "Selecionar / Copiar  [F7]", ToolMode.Select);

        var undoRow = new FlowLayoutPanel { Width = 185, Height = 36, WrapContents = false };
        var undo = SmallButton("↶ Desfazer", 88);
        undo.Click += (_, _) => canvas.Undo();
        var clear = SmallButton("✕ Limpar", 88);
        clear.Click += (_, _) => canvas.ClearAll();
        undoRow.Controls.Add(undo);
        undoRow.Controls.Add(clear);
        root.Controls.Add(undoRow);

        root.Controls.Add(Section("TRAÇO"));
        var strokeRow = new FlowLayoutPanel { Width = 185, Height = 36, WrapContents = false };
        strokeRow.Controls.Add(new Label { Text = "Espessura", Width = 85, Height = 28, TextAlign = ContentAlignment.MiddleLeft });
        thickness = new NumericUpDown { Minimum = 1, Maximum = 20, Value = 3, Width = 70, Height = 28 };
        strokeRow.Controls.Add(thickness);
        root.Controls.Add(strokeRow);
        filled = new CheckBox { Text = "Preencher retângulo / elipse", Width = 185, Height = 26 };
        root.Controls.Add(filled);

        root.Controls.Add(Section("CORES"));
        var colors = new FlowLayoutPanel { Width = 185, Height = 66, WrapContents = true };
        foreach (var c in new[]
        {
            Color.FromArgb(0,120,255), Color.Red, Color.FromArgb(255,120,0), Color.Gold,
            Color.LimeGreen, Color.DeepSkyBlue, Color.White, Color.Black
        }) AddColor(colors, c);
        root.Controls.Add(colors);

        root.Controls.Add(Section("PONTEIRO"));
        AddPointer(root, "F1  Desligado", PointerMode.Off);
        AddPointer(root, "F2  Anel", PointerMode.Ring);
        AddPointer(root, "F3  Anel grande", PointerMode.BigRing);
        AddPointer(root, "F4  Alvo", PointerMode.Target);
        AddPointer(root, "F5  Mão", PointerMode.Hand);
        AddPointer(root, "F6  Mira / caneta", PointerMode.Cross);

        var help = new Label
        {
            Text = "F8 abre/minimiza\r\nF9 SOLTA TUDO\r\nCtrl+Alt+F12 emergência\r\nBotão direito solta a ferramenta\r\nX limpa, desliga efeitos e minimiza",
            Width = 185,
            Height = 92,
            BackColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle,
            Padding = new Padding(5)
        };
        root.Controls.Add(help);

        uiTimer = new Timer { Interval = 16 };
        uiTimer.Tick += UiTimer_Tick;
        uiTimer.Start();

        FormClosing += MainForm_FormClosing;
        Move += (_, _) => SaveLocation();
        Resize += MainForm_Resize;
        Shown += (_, _) =>
        {
            RegisterGlobalHotkeys();
            canvas.Show();
            canvas.SetInteractive(false);
            ApplyPointerMode(pointerMode);
            if (startup)
            {
                DeactivateAndMinimize();
                startup = false;
            }
        };

        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.Escape)
            {
                PanicRelease();
                e.Handled = true;
            }
        };
    }

    Label Section(string text) => new()
    {
        Text = text,
        Width = 185,
        Height = 23,
        TextAlign = ContentAlignment.BottomLeft,
        Font = new Font(Font.FontFamily, 8.5f, FontStyle.Bold),
        ForeColor = Color.FromArgb(80, 80, 80)
    };

    Button SmallButton(string text, int width) => new()
    {
        Text = text,
        Width = width,
        Height = 30,
        FlatStyle = FlatStyle.System
    };

    void AddTool(Control parent, string text, ToolMode mode)
    {
        var b = new Button { Text = text, Width = 185, Height = 31, TextAlign = ContentAlignment.MiddleLeft };
        b.Click += (_, _) => SetTool(mode);
        parent.Controls.Add(b);
        toolButtons[mode] = b;
    }

    void AddPointer(Control parent, string text, PointerMode mode)
    {
        var b = new Button { Text = text, Width = 185, Height = 30, TextAlign = ContentAlignment.MiddleLeft };
        b.Click += (_, _) => SetPointer(mode);
        parent.Controls.Add(b);
        pointerButtons[mode] = b;
    }

    void AddColor(Control parent, Color c)
    {
        var b = new Button { Width = 38, Height = 27, BackColor = c, FlatStyle = FlatStyle.Flat, Text = "" };
        if (c == Color.White) b.FlatAppearance.BorderColor = Color.Gray;
        b.Click += (_, _) =>
        {
            inkColor = c;
            foreach (var x in colorButtons) x.FlatAppearance.BorderSize = 1;
            b.FlatAppearance.BorderSize = 3;
        };
        parent.Controls.Add(b);
        colorButtons.Add(b);
        if (colorButtons.Count == 1) b.FlatAppearance.BorderSize = 3;
    }

    void SetTool(ToolMode mode)
    {
        RestoreFromTaskbar();
        if (mode == ToolMode.Mouse)
        {
            ReleaseDrawingOnly();
            return;
        }

        if (mode == ToolMode.Select)
        {
            PrepareSelectionSnapshot();
        }

        toolMode = mode;
        canvas.SetMode(mode);
        canvas.SetInteractive(true);
        status.Text = mode == ToolMode.Select ? "SELECIONE UMA ÁREA" : mode.ToString().ToUpperInvariant();
        UpdateToolButtons();
    }

    void SetPointer(PointerMode mode)
    {
        RestoreFromTaskbar();
        pointerMode = mode;
        ApplyPointerMode(mode);
        UpdatePointerButtons();
        canvas.InvalidateHaloArea();
    }

    void ApplyPointerMode(PointerMode mode)
    {
        Native.RestoreSystemCursors();
        if (mode == PointerMode.Hand)
            Native.ReplaceArrowCursor(Cursors.Hand);
        else if (mode == PointerMode.Cross)
            Native.ReplaceArrowCursor(Cursors.Cross);
    }

    void UpdateToolButtons()
    {
        foreach (var kv in toolButtons)
            kv.Value.BackColor = kv.Key == toolMode ? Color.FromArgb(205, 230, 255) : SystemColors.Control;
    }

    void UpdatePointerButtons()
    {
        foreach (var kv in pointerButtons)
            kv.Value.BackColor = kv.Key == pointerMode ? Color.FromArgb(205, 230, 255) : SystemColors.Control;
    }

    public void ReleaseDrawingOnly()
    {
        toolMode = ToolMode.Mouse;
        canvas.SetMode(ToolMode.Mouse);
        canvas.SetInteractive(false);
        status.Text = "MOUSE LIVRE";
        UpdateToolButtons();
    }

    public void PanicRelease()
    {
        ReleaseDrawingOnly();
        pointerMode = PointerMode.Off;
        Native.RestoreSystemCursors();
        status.Text = "LIBERADO  •  SEM EFEITOS";
        UpdatePointerButtons();
        canvas.Invalidate();
    }

    void DeactivateAndMinimize()
    {
        canvas.ClearAll();
        toolMode = ToolMode.Mouse;
        pointerMode = PointerMode.Off;
        Native.RestoreSystemCursors();
        selectionSnapshot?.Dispose();
        selectionSnapshot = null;
        canvas.SetMode(ToolMode.Mouse);
        canvas.SetInteractive(false);
        canvas.Hide();
        status.Text = "INATIVO";
        UpdateToolButtons();
        UpdatePointerButtons();
        WindowState = FormWindowState.Minimized;
    }

    void RestoreFromTaskbar()
    {
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Show();
        BringToFront();
        Activate();
        if (!canvas.Visible) canvas.Show();
        canvas.SetInteractive(toolMode != ToolMode.Mouse);
    }

    void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
    {
        if (allowRealExit) return;
        e.Cancel = true;
        DeactivateAndMinimize();
    }

    void MainForm_Resize(object? sender, EventArgs e)
    {
        if (WindowState == FormWindowState.Normal && !canvas.Visible)
        {
            canvas.Show();
            canvas.SetInteractive(false);
        }
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        if (Visible) RegisterGlobalHotkeys();
    }

    protected override void OnHandleDestroyed(EventArgs e)
    {
        UnregisterGlobalHotkeys();
        Native.RestoreSystemCursors();
        base.OnHandleDestroyed(e);
    }

    void RegisterGlobalHotkeys()
    {
        Native.RegisterHotKey(Handle, HOTKEY_F8, 0, (uint)Keys.F8);
        Native.RegisterHotKey(Handle, HOTKEY_F9, 0, (uint)Keys.F9);
        Native.RegisterHotKey(Handle, HOTKEY_F7, 0, (uint)Keys.F7);
        Native.RegisterHotKey(Handle, HOTKEY_F1, 0, (uint)Keys.F1);
        Native.RegisterHotKey(Handle, HOTKEY_F2, 0, (uint)Keys.F2);
        Native.RegisterHotKey(Handle, HOTKEY_F3, 0, (uint)Keys.F3);
        Native.RegisterHotKey(Handle, HOTKEY_F4, 0, (uint)Keys.F4);
        Native.RegisterHotKey(Handle, HOTKEY_F5, 0, (uint)Keys.F5);
        Native.RegisterHotKey(Handle, HOTKEY_F6, 0, (uint)Keys.F6);
        Native.RegisterHotKey(Handle, HOTKEY_PANIC, Native.MOD_CONTROL | Native.MOD_ALT, (uint)Keys.F12);
    }

    void UnregisterGlobalHotkeys()
    {
        foreach (var id in new[] { HOTKEY_F8, HOTKEY_F9, HOTKEY_F7, HOTKEY_F1, HOTKEY_F2, HOTKEY_F3, HOTKEY_F4, HOTKEY_F5, HOTKEY_F6, HOTKEY_PANIC })
            Native.UnregisterHotKey(Handle, id);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Native.WM_HOTKEY)
        {
            var id = m.WParam.ToInt32();
            if (id == HOTKEY_F8)
            {
                if (WindowState == FormWindowState.Minimized) RestoreFromTaskbar();
                else WindowState = FormWindowState.Minimized;
                return;
            }
            if (id == HOTKEY_F9 || id == HOTKEY_PANIC) { PanicRelease(); return; }
            if (id == HOTKEY_F7) { SetTool(ToolMode.Select); return; }
            if (id == HOTKEY_F1) { SetPointer(PointerMode.Off); return; }
            if (id == HOTKEY_F2) { SetPointer(PointerMode.Ring); return; }
            if (id == HOTKEY_F3) { SetPointer(PointerMode.BigRing); return; }
            if (id == HOTKEY_F4) { SetPointer(PointerMode.Target); return; }
            if (id == HOTKEY_F5) { SetPointer(PointerMode.Hand); return; }
            if (id == HOTKEY_F6) { SetPointer(PointerMode.Cross); return; }
        }
        base.WndProc(ref m);
    }

    void UiTimer_Tick(object? sender, EventArgs e)
    {
        var cursor = Cursor.Position;
        var leftDown = (Control.MouseButtons & MouseButtons.Left) != 0;
        if (leftDown && !leftWasDown) pulseStarted = Environment.TickCount64;
        leftWasDown = leftDown;

        var newRect = canvas.GetHaloScreenBounds(cursor);
        var union = Rectangle.Union(oldHaloRect, newRect);
        oldHaloRect = newRect;
        if (canvas.Visible && !union.IsEmpty) canvas.InvalidateScreenRect(union);
    }

    void PrepareSelectionSnapshot()
    {
        selectionSnapshot?.Dispose();
        var oldOpacity = Opacity;
        var oldPointer = pointerMode;
        Opacity = 0;
        pointerMode = PointerMode.Off;
        canvas.Invalidate();
        Application.DoEvents();
        Thread.Sleep(45);

        var vs = SystemInformation.VirtualScreen;
        var bmp = new Bitmap(vs.Width, vs.Height, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
            g.CopyFromScreen(vs.Left, vs.Top, 0, 0, vs.Size, CopyPixelOperation.SourceCopy);
        selectionSnapshot = bmp;

        Opacity = oldOpacity;
        pointerMode = oldPointer;
        canvas.Invalidate();
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
            try { Clipboard.SetImage(new Bitmap(crop)); }
            catch { }
            status.Text = $"COPIADO  {local.Width} × {local.Height}";
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
            if (k?.GetValue("X") is int x && k.GetValue("Y") is int y)
            {
                var p = new Point(x, y);
                if (Screen.AllScreens.Any(s => s.WorkingArea.Contains(p))) Location = p;
                else Location = new Point(40, 80);
            }
            else Location = new Point(40, 80);
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
}

sealed class CanvasForm : Form
{
    readonly MainForm owner;
    readonly List<InkShape> shapes = new();
    InkShape? current;
    ToolMode mode = ToolMode.Mouse;
    Point start;
    Point last;
    bool dragging;
    Rectangle selectionRect = Rectangle.Empty;
    Rectangle oldSelectionRect = Rectangle.Empty;
    bool interactive;

    public CanvasForm(MainForm owner)
    {
        this.owner = owner;
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
        KeyPreview = true;
        Cursor = Cursors.Cross;

        MouseDown += Canvas_MouseDown;
        MouseMove += Canvas_MouseMove;
        MouseUp += Canvas_MouseUp;
        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.Escape)
            {
                owner.PanicRelease();
                e.Handled = true;
            }
        };
    }

    protected override bool ShowWithoutActivation => true;

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ExStyle |= Native.WS_EX_TOOLWINDOW | Native.WS_EX_NOACTIVATE;
            return cp;
        }
    }

    public void SetMode(ToolMode m)
    {
        mode = m;
        Cursor = m == ToolMode.Eraser ? Cursors.NoMove2D : Cursors.Cross;
        dragging = false;
        current = null;
        selectionRect = Rectangle.Empty;
        Invalidate();
    }

    public void SetInteractive(bool value)
    {
        interactive = value;
        if (!IsHandleCreated) return;
        var style = Native.GetWindowLong(Handle, Native.GWL_EXSTYLE);
        if (value) style &= ~Native.WS_EX_TRANSPARENT;
        else style |= Native.WS_EX_TRANSPARENT;
        style |= Native.WS_EX_NOACTIVATE | Native.WS_EX_TOOLWINDOW;
        Native.SetWindowLong(Handle, Native.GWL_EXSTYLE, style);
        Native.SetWindowPos(Handle, IntPtr.Zero, 0, 0, 0, 0,
            Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOZORDER | Native.SWP_NOACTIVATE | Native.SWP_FRAMECHANGED);
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        SetInteractive(interactive);
    }

    void Canvas_MouseDown(object? sender, MouseEventArgs e)
    {
        if (!interactive) return;
        if (e.Button == MouseButtons.Right)
        {
            owner.ReleaseDrawingOnly();
            return;
        }
        if (e.Button != MouseButtons.Left) return;

        start = e.Location;
        last = e.Location;
        dragging = true;

        switch (mode)
        {
            case ToolMode.Pen:
                current = new StrokeShape(owner.InkColor, owner.InkWidth, false, e.Location);
                shapes.Add(current);
                break;
            case ToolMode.Highlighter:
                current = new StrokeShape(Color.FromArgb(90, owner.InkColor), Math.Max(8, owner.InkWidth * 4), true, e.Location);
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
                EraseAt(e.Location);
                break;
            case ToolMode.Text:
                dragging = false;
                owner.AddTextAt(e.Location);
                break;
            case ToolMode.Select:
                selectionRect = Rectangle.Empty;
                oldSelectionRect = Rectangle.Empty;
                break;
        }
    }

    void Canvas_MouseMove(object? sender, MouseEventArgs e)
    {
        if (!interactive || !dragging) return;
        var before = current?.Bounds ?? Rectangle.Empty;
        switch (mode)
        {
            case ToolMode.Pen:
            case ToolMode.Highlighter:
                if (current is StrokeShape s) s.Add(e.Location);
                break;
            case ToolMode.Line:
            case ToolMode.Arrow:
                if (current is LineShape l) l.B = e.Location;
                break;
            case ToolMode.Rectangle:
            case ToolMode.Ellipse:
                if (current is RectShape r) r.Rect = RectFrom(start, e.Location);
                break;
            case ToolMode.Eraser:
                EraseAt(e.Location);
                break;
            case ToolMode.Select:
                oldSelectionRect = selectionRect;
                selectionRect = RectFrom(start, e.Location);
                var sr = Rectangle.Union(oldSelectionRect, selectionRect);
                sr.Inflate(4, 4);
                Invalidate(sr);
                last = e.Location;
                return;
        }
        var after = current?.Bounds ?? Rectangle.Empty;
        var dirty = Rectangle.Union(before, after);
        dirty = Rectangle.Union(dirty, Rectangle.FromLTRB(Math.Min(last.X, e.X), Math.Min(last.Y, e.Y), Math.Max(last.X, e.X) + 1, Math.Max(last.Y, e.Y) + 1));
        dirty.Inflate(28, 28);
        Invalidate(dirty);
        last = e.Location;
    }

    void Canvas_MouseUp(object? sender, MouseEventArgs e)
    {
        if (!interactive || !dragging || e.Button != MouseButtons.Left) return;
        dragging = false;

        if (mode == ToolMode.Select)
        {
            selectionRect = RectFrom(start, e.Location);
            var screenRect = new Rectangle(PointToScreen(selectionRect.Location), selectionRect.Size);
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

    public Rectangle GetHaloScreenBounds(Point cursor)
    {
        if (owner.CurrentPointer == PointerMode.Off || !Visible) return Rectangle.Empty;
        var r = owner.CurrentPointer == PointerMode.BigRing ? 54 : 36;
        if (owner.PulseActive) r += 36;
        return new Rectangle(cursor.X - r - 6, cursor.Y - r - 6, (r + 6) * 2, (r + 6) * 2);
    }

    public void InvalidateScreenRect(Rectangle screenRect)
    {
        if (screenRect.IsEmpty) return;
        var local = new Rectangle(screenRect.X - Left, screenRect.Y - Top, screenRect.Width, screenRect.Height);
        Invalidate(local);
    }

    public void InvalidateHaloArea() => InvalidateScreenRect(GetHaloScreenBounds(Cursor.Position));

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
        var radius = pm == PointerMode.BigRing ? 38 : 25;
        using var pen = new Pen(Color.FromArgb(0, 120, 255), 4);

        if (pm is PointerMode.Ring or PointerMode.BigRing or PointerMode.Hand or PointerMode.Cross)
            g.DrawEllipse(pen, p.X - radius, p.Y - radius, radius * 2, radius * 2);
        else if (pm == PointerMode.Target)
        {
            g.DrawEllipse(pen, p.X - radius, p.Y - radius, radius * 2, radius * 2);
            g.DrawLine(pen, p.X - radius - 12, p.Y, p.X + radius + 12, p.Y);
            g.DrawLine(pen, p.X, p.Y - radius - 12, p.X, p.Y + radius + 12);
        }

        if (owner.PulseActive)
        {
            var t = Math.Clamp(owner.PulseAge / 300f, 0, 1);
            var rr = radius + (int)(44 * t);
            using var pulse = new Pen(Color.FromArgb((int)(210 * (1 - t)), 0, 150, 255), 5);
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
    readonly bool highlighter;
    public StrokeShape(Color c, float w, bool hi, Point first) : base(c, w) { highlighter = hi; points.Add(first); }
    public void Add(Point p) { if (points.Count == 0 || Distance(points[^1], p) >= 1.2) points.Add(p); }
    public override Rectangle Bounds
    {
        get
        {
            if (points.Count == 0) return Rectangle.Empty;
            var minX = points.Min(p => p.X); var maxX = points.Max(p => p.X);
            var minY = points.Min(p => p.Y); var maxY = points.Max(p => p.Y);
            var r = Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1); r.Inflate((int)Width + 5, (int)Width + 5); return r;
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
        for (int i = 1; i < points.Count; i++) if (DistToSegment(p, points[i - 1], points[i]) <= tol + Width / 2) return true;
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
    public LineShape(Color c, float w, Point a, Point b, bool arrow) : base(c, w) { A = a; B = b; this.arrow = arrow; }
    public override Rectangle Bounds
    {
        get { var r = Rectangle.FromLTRB(Math.Min(A.X, B.X), Math.Min(A.Y, B.Y), Math.Max(A.X, B.X) + 1, Math.Max(A.Y, B.Y) + 1); r.Inflate(30, 30); return r; }
    }
    public override void Draw(Graphics g)
    {
        using var p = new Pen(Color, Width) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        if (arrow) p.CustomEndCap = new AdjustableArrowCap(Math.Max(4, Width * 2.5f), Math.Max(5, Width * 3f), true);
        g.DrawLine(p, A, B);
    }
    public override bool Hit(Point p, float tol)
    {
        var s = new StrokeShape(Color, Width, false, A); s.Add(B); return s.Hit(p, tol);
    }
}

sealed class RectShape : InkShape
{
    public Rectangle Rect { get; set; }
    readonly bool ellipse;
    readonly bool fill;
    public RectShape(Color c, float w, Rectangle r, bool ellipse, bool fill) : base(c, w) { Rect = r; this.ellipse = ellipse; this.fill = fill; }
    public override Rectangle Bounds { get { var r = Rect; r.Inflate((int)Width + 4, (int)Width + 4); return r; } }
    public override void Draw(Graphics g)
    {
        if (Rect.Width < 1 || Rect.Height < 1) return;
        if (fill)
        {
            using var b = new SolidBrush(Color.FromArgb(Math.Min(220, Color.A), Color));
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
    Rectangle cached;
    public TextShape(string text, Point at, Color c, float size) : base(c, 1) { this.text = text; this.at = at; this.size = size; cached = new Rectangle(at, new Size(Math.Max(20, text.Length * (int)(size * .65f)), (int)(size * 1.8f))); }
    public override Rectangle Bounds => cached;
    public override void Draw(Graphics g)
    {
        using var font = new Font(SystemFonts.MessageBoxFont.FontFamily, size, FontStyle.Bold, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(Color);
        g.DrawString(text, font, brush, at);
    }
    public override bool Hit(Point p, float tol) { var r = cached; r.Inflate((int)tol, (int)tol); return r.Contains(p); }
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
    const uint OCR_NORMAL = 32512;
    const uint SPI_SETCURSORS = 0x0057;

    [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll", SetLastError = true)] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll", SetLastError = true)] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll", SetLastError = true)] static extern bool SetSystemCursor(IntPtr hcur, uint id);
    [DllImport("user32.dll", SetLastError = true)] static extern bool SystemParametersInfo(uint action, uint param, IntPtr pvParam, uint flags);
    [DllImport("user32.dll")] static extern IntPtr CopyIcon(IntPtr hIcon);

    public static void ReplaceArrowCursor(Cursor cursor)
    {
        try
        {
            var copy = CopyIcon(cursor.Handle);
            if (copy != IntPtr.Zero) SetSystemCursor(copy, OCR_NORMAL);
        }
        catch { }
    }

    public static void RestoreSystemCursors()
    {
        try { SystemParametersInfo(SPI_SETCURSORS, 0, IntPtr.Zero, 0); } catch { }
    }
}
