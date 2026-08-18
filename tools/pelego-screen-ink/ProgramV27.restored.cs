using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace PelegoMarkerV2;

enum ToolMode { Mouse, Pen, Highlighter, Line, Arrow, Rectangle, Ellipse, Text, Eraser, Select }
enum PointerStyle { Off, Ring, Target, LargeRing, HandSmall, HandMedium, HandLarge, PenMedium, PenLarge }

static class Native
{
    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_TRANSPARENT = 0x20;
    public const int WS_EX_TOOLWINDOW = 0x80;
    public const int WS_EX_NOACTIVATE = 0x08000000;
    public const int WH_MOUSE_LL = 14;
    public const int WM_LBUTTONDOWN = 0x0201;
    public const int WM_LBUTTONUP = 0x0202;
    public const int WM_RBUTTONDOWN = 0x0204;
    public const int WM_HOTKEY = 0x0312;
    public const int MOD_ALT = 0x0001;
    public const int MOD_CONTROL = 0x0002;
    public const int SW_RESTORE = 9;

    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd, int id, int fsModifiers, int vk);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")] public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll")] public static extern IntPtr GetModuleHandle(string? lpModuleName);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string? lpClassName, string? lpWindowName);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);

    public delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int x; public int y; }
    [StructLayout(LayoutKind.Sequential)] public struct MSLLHOOKSTRUCT
    {
        public POINT pt; public uint mouseData; public uint flags; public uint time; public IntPtr dwExtraInfo;
    }
}

abstract class Mark
{
    public Color Color;
    public float Width;
    public abstract void Draw(Graphics g);
    public abstract RectangleF Bounds { get; }
}

sealed class PenMark : Mark
{
    public readonly List<Point> Points = new();
    public override void Draw(Graphics g)
    {
        if (Points.Count == 0) return;
        using var p = new Pen(Color, Width) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        if (Points.Count == 1)
        {
            using var b = new SolidBrush(Color);
            g.FillEllipse(b, Points[0].X - Width / 2f, Points[0].Y - Width / 2f, Width, Width);
        }
        else g.DrawLines(p, Points.ToArray());
    }
    public override RectangleF Bounds
    {
        get
        {
            if (Points.Count == 0) return RectangleF.Empty;
            float minX = Points[0].X, minY = Points[0].Y, maxX = minX, maxY = minY;
            foreach (var pt in Points)
            {
                minX = Math.Min(minX, pt.X); minY = Math.Min(minY, pt.Y);
                maxX = Math.Max(maxX, pt.X); maxY = Math.Max(maxY, pt.Y);
            }
            return RectangleF.FromLTRB(minX - Width - 3, minY - Width - 3, maxX + Width + 3, maxY + Width + 3);
        }
    }
}

sealed class LineMark : Mark
{
    public Point A, B;
    public bool Arrow;
    public override void Draw(Graphics g)
    {
        using var p = new Pen(Color, Width) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        if (Arrow) p.CustomEndCap = new AdjustableArrowCap(Math.Max(4, Width * 1.8f), Math.Max(5, Width * 2.2f), true);
        g.DrawLine(p, A, B);
    }
    public override RectangleF Bounds => RectangleF.FromLTRB(
        Math.Min(A.X, B.X) - Width * 4 - 5,
        Math.Min(A.Y, B.Y) - Width * 4 - 5,
        Math.Max(A.X, B.X) + Width * 4 + 5,
        Math.Max(A.Y, B.Y) + Width * 4 + 5);
}

sealed class BoxMark : Mark
{
    public Point A, B;
    public bool Ellipse;
    public bool Fill;
    Rectangle Rect => Rectangle.FromLTRB(Math.Min(A.X, B.X), Math.Min(A.Y, B.Y), Math.Max(A.X, B.X), Math.Max(A.Y, B.Y));
    public override void Draw(Graphics g)
    {
        var r = Rect;
        if (r.Width <= 0 || r.Height <= 0) return;
        if (Fill)
        {
            using var b = new SolidBrush(Color);
            if (Ellipse) g.FillEllipse(b, r); else g.FillRectangle(b, r);
        }
        using var p = new Pen(Color, Width);
        if (Ellipse) g.DrawEllipse(p, r); else g.DrawRectangle(p, r);
    }
    public override RectangleF Bounds
    {
        get { var r = Rect; r.Inflate((int)Math.Ceiling(Width * 2) + 4, (int)Math.Ceiling(Width * 2) + 4); return r; }
    }
}

sealed class TextMark : Mark
{
    public Point Position;
    public string Text = "";
    public override void Draw(Graphics g)
    {
        using var f = new Font("Segoe UI", Math.Max(14f, Width * 4.2f), FontStyle.Bold, GraphicsUnit.Pixel);
        using var b = new SolidBrush(Color);
        g.DrawString(Text, f, b, Position);
    }
    public override RectangleF Bounds => new(Position.X, Position.Y, Math.Max(100, Text.Length * Width * 5), Math.Max(28, Width * 7));
}

sealed class TextInputForm : Form
{
    readonly TextBox box = new();
    public string ResultText => box.Text;
    public TextInputForm(Point screenPoint, Icon icon)
    {
        Text = "Digite o texto"; Icon = icon; TopMost = true; ShowInTaskbar = false;
        FormBorderStyle = FormBorderStyle.FixedToolWindow; StartPosition = FormStartPosition.Manual;
        Size = new Size(360, 105); Location = new Point(screenPoint.X - 20, screenPoint.Y - 20);
        box.SetBounds(10, 10, 324, 27); box.Font = new Font("Segoe UI", 12f); Controls.Add(box);
        var ok = new Button { Text = "OK", DialogResult = DialogResult.OK }; ok.SetBounds(254, 45, 80, 28); Controls.Add(ok); AcceptButton = ok;
        Shown += (_, _) => box.Focus();
    }
}

sealed class OverlayForm : Form
{
    readonly List<Mark> marks = new();
    Mark? current;
    bool drawing;
    ToolMode tool = ToolMode.Mouse;
    Color drawColor = Color.FromArgb(33, 150, 243);
    float drawWidth = 3f;
    bool fillShapes;
    PointerStyle pointerStyle = PointerStyle.Ring;
    readonly System.Windows.Forms.Timer pointerTimer = new();
    Rectangle lastPointerRect = Rectangle.Empty;
    int pulseFrames;
    int pressedFrames;
    Point pulseScreen;
    Rectangle selectRect = Rectangle.Empty;
    Point selectStart;
    bool selecting;
    bool suppressPointer;
    bool active;
    bool nativeCursorHidden;
    ToolbarForm? toolbar;
    Native.LowLevelMouseProc? hookProc;
    IntPtr hook = IntPtr.Zero;

    public ToolMode CurrentTool => tool;
    public Color DrawColor => drawColor;
    public float DrawWidth => drawWidth;
    public bool FillShapes => fillShapes;
    public PointerStyle PointerStyle => pointerStyle;
    public bool ProgramActive => active;

    public OverlayForm()
    {
        StartPosition = FormStartPosition.Manual;
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        BackColor = Color.Fuchsia;
        TransparencyKey = Color.Fuchsia;
        DoubleBuffered = true;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
        UpdateVirtualBounds();
        pointerTimer.Interval = 16;
        pointerTimer.Tick += PointerTick;
        hookProc = MouseHook;
        SystemEvents.DisplaySettingsChanged += DisplaySettingsChanged;
    }

    protected override CreateParams CreateParams
    {
        get { var cp = base.CreateParams; cp.ExStyle |= Native.WS_EX_TOOLWINDOW; return cp; }
    }

    void DisplaySettingsChanged(object? sender, EventArgs e) => BeginInvoke(new Action(UpdateVirtualBounds));
    void UpdateVirtualBounds() { Bounds = SystemInformation.VirtualScreen; }
    public void AttachToolbar(ToolbarForm t) => toolbar = t;
    Point ScreenToOverlay(Point p) => new(p.X - SystemInformation.VirtualScreen.Left, p.Y - SystemInformation.VirtualScreen.Top);
    RectangleF CurrentBounds() => current?.Bounds ?? RectangleF.Empty;

    public void ActivateProgram()
    {
        if (active) { RefreshHookState(); return; }
        active = true;
        UpdateVirtualBounds();
        Show();
        ApplyToolWindowStyle();
        pointerTimer.Start();
        RefreshHookState();
        TopMost = true; BringToFront(); toolbar?.BringToFront();
        Invalidate();
    }

    public void DeactivateAndReset()
    {
        active = false;
        drawing = selecting = false;
        Capture = false;
        marks.Clear(); current = null; selectRect = Rectangle.Empty;
        tool = ToolMode.Mouse;
        pointerStyle = PointerStyle.Off;
        pulseFrames = pressedFrames = 0;
        suppressPointer = false;
        StopHook();
        pointerTimer.Stop();
        EnsureNativeCursorVisible();
        SaveSettings();
        Hide();
    }

    public void SetTool(ToolMode value)
    {
        if (!active) ActivateProgram();
        tool = value; drawing = selecting = false; Capture = false; current = null; selectRect = Rectangle.Empty;
        ApplyToolWindowStyle();
        TopMost = true; BringToFront(); toolbar?.BringToFront();
        Invalidate();
    }

    void ApplyToolWindowStyle()
    {
        if (!IsHandleCreated) return;
        int ex = Native.GetWindowLong(Handle, Native.GWL_EXSTYLE);
        if (tool == ToolMode.Mouse)
        {
            ex |= Native.WS_EX_TRANSPARENT | Native.WS_EX_NOACTIVATE;
            Cursor = Cursors.Default;
        }
        else
        {
            ex &= ~Native.WS_EX_TRANSPARENT; ex &= ~Native.WS_EX_NOACTIVATE;
            Cursor = tool == ToolMode.Eraser ? Cursors.No : Cursors.Cross;
        }
        Native.SetWindowLong(Handle, Native.GWL_EXSTYLE, ex);
        RefreshNativeCursorVisibility();
    }

    public void SetColor(Color c) { drawColor = c; SaveSettings(); toolbar?.SyncState(); }
    public void SetWidth(float w) { drawWidth = Math.Clamp(w, 1f, 20f); SaveSettings(); toolbar?.SyncState(); }
    public void SetFill(bool fill) { fillShapes = fill; SaveSettings(); toolbar?.SyncState(); }
    public void SetPointerStyle(PointerStyle style)
    {
        if (!active && style != PointerStyle.Off) ActivateProgram();
        pointerStyle = style;
        pulseFrames = pressedFrames = 0;
        SaveSettings();
        RefreshNativeCursorVisibility();
        RefreshHookState();
        Invalidate();
        toolbar?.SyncState();
    }

    public void Undo() { if (marks.Count > 0) { var b = marks[^1].Bounds; marks.RemoveAt(marks.Count - 1); Invalidate(Rectangle.Round(b)); } }
    public void ClearAll() { marks.Clear(); current = null; selectRect = Rectangle.Empty; Invalidate(); }

    public void LoadSettings()
    {
        try
        {
            using var k = Registry.CurrentUser.OpenSubKey(@"Software\PELEGO\MarcadorTelaV2");
            if (k == null) return;
            if (k.GetValue("Color") is object c) drawColor = Color.FromArgb(Convert.ToInt32(c));
            if (k.GetValue("Width") is object w) drawWidth = Math.Clamp(Convert.ToSingle(w), 1f, 20f);
            if (k.GetValue("FillShapes") is object f) fillShapes = Convert.ToInt32(f) != 0;
            if (k.GetValue("PointerStyle") is object p) pointerStyle = (PointerStyle)Math.Clamp(Convert.ToInt32(p), 0, Enum.GetValues<PointerStyle>().Length - 1);
        }
        catch { }
    }

    void SaveSettings()
    {
        try
        {
            using var k = Registry.CurrentUser.CreateSubKey(@"Software\PELEGO\MarcadorTelaV2");
            k.SetValue("Color", drawColor.ToArgb(), RegistryValueKind.DWord);
            k.SetValue("Width", (int)Math.Round(drawWidth), RegistryValueKind.DWord);
            k.SetValue("FillShapes", fillShapes ? 1 : 0, RegistryValueKind.DWord);
            k.SetValue("PointerStyle", (int)pointerStyle, RegistryValueKind.DWord);
        }
        catch { }
    }

    void RefreshHookState()
    {
        if (active && pointerStyle != PointerStyle.Off) StartHook(); else StopHook();
    }

    void StartHook()
    {
        if (hook != IntPtr.Zero || hookProc == null) return;
        hook = Native.SetWindowsHookEx(Native.WH_MOUSE_LL, hookProc, Native.GetModuleHandle(null), 0);
    }
    void StopHook()
    {
        if (hook == IntPtr.Zero) return;
        Native.UnhookWindowsHookEx(hook); hook = IntPtr.Zero;
    }

    IntPtr MouseHook(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && active && pointerStyle != PointerStyle.Off)
        {
            int msg = wParam.ToInt32();
            if (msg == Native.WM_LBUTTONDOWN || msg == Native.WM_RBUTTONDOWN)
            {
                var data = Marshal.PtrToStructure<Native.MSLLHOOKSTRUCT>(lParam);
                pulseScreen = new Point(data.pt.x, data.pt.y);
                pulseFrames = 10;
                pressedFrames = 7;
                var p = ScreenToOverlay(pulseScreen);
                Invalidate(new Rectangle(p.X - 90, p.Y - 90, 180, 180));
            }
            else if (msg == Native.WM_LBUTTONUP) pressedFrames = 0;
        }
        return Native.CallNextHookEx(hook, nCode, wParam, lParam);
    }

    void PointerTick(object? sender, EventArgs e)
    {
        if (!active) return;
        if (pointerStyle == PointerStyle.Off && pulseFrames <= 0) return;
        var p = ScreenToOverlay(Cursor.Position);
        int radius = PointerRadius();
        var nr = new Rectangle(p.X - radius - 18, p.Y - radius - 18, (radius + 18) * 2, (radius + 18) * 2);
        var union = lastPointerRect.IsEmpty ? nr : Rectangle.Union(lastPointerRect, nr);
        if (pulseFrames > 0)
        {
            var pp = ScreenToOverlay(pulseScreen);
            union = Rectangle.Union(union, new Rectangle(pp.X - 90, pp.Y - 90, 180, 180));
            pulseFrames--;
        }
        if (pressedFrames > 0) pressedFrames--;
        lastPointerRect = nr;
        Invalidate(union);
    }

    int PointerRadius() => pointerStyle switch
    {
        PointerStyle.LargeRing => 38,
        PointerStyle.HandSmall => 26,
        PointerStyle.HandMedium => 34,
        PointerStyle.HandLarge => 44,
        PointerStyle.PenMedium => 32,
        PointerStyle.PenLarge => 44,
        _ => 25
    };

    bool IsSyntheticPointer => pointerStyle is PointerStyle.HandSmall or PointerStyle.HandMedium or PointerStyle.HandLarge or PointerStyle.PenMedium or PointerStyle.PenLarge;
    void RefreshNativeCursorVisibility()
    {
        bool shouldHide = active && tool == ToolMode.Mouse && IsSyntheticPointer;
        if (shouldHide && !nativeCursorHidden) { Cursor.Hide(); nativeCursorHidden = true; }
        else if (!shouldHide && nativeCursorHidden) EnsureNativeCursorVisible();
    }
    void EnsureNativeCursorVisible()
    {
        if (!nativeCursorHidden) return;
        Cursor.Show(); nativeCursorHidden = false;
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button == MouseButtons.Right)
        {
            SetTool(ToolMode.Mouse); toolbar?.SyncState(); return;
        }
        if (e.Button != MouseButtons.Left || tool == ToolMode.Mouse) return;

        if (tool == ToolMode.Text)
        {
            var screen = PointToScreen(e.Location);
            suppressPointer = true; Invalidate(); Update();
            using var f = new TextInputForm(screen, toolbar?.Icon ?? SystemIcons.Application);
            if (f.ShowDialog() == DialogResult.OK && !string.IsNullOrWhiteSpace(f.ResultText))
            {
                marks.Add(new TextMark { Position = e.Location, Text = f.ResultText, Color = drawColor, Width = drawWidth });
            }
            suppressPointer = false; Invalidate(); return;
        }
        if (tool == ToolMode.Eraser) { drawing = true; Capture = true; EraseAt(e.Location); return; }
        if (tool == ToolMode.Select)
        {
            selecting = true; selectStart = e.Location; selectRect = Rectangle.Empty; Capture = true; return;
        }

        drawing = true;
        if (tool is ToolMode.Pen or ToolMode.Highlighter)
        {
            current = new PenMark
            {
                Color = tool == ToolMode.Highlighter ? Color.FromArgb(255, 235, 59) : drawColor,
                Width = tool == ToolMode.Highlighter ? Math.Max(12f, drawWidth * 3f) : drawWidth
            };
            ((PenMark)current).Points.Add(e.Location);
        }
        else if (tool is ToolMode.Line or ToolMode.Arrow)
        {
            current = new LineMark { A = e.Location, B = e.Location, Arrow = tool == ToolMode.Arrow, Color = drawColor, Width = drawWidth };
        }
        else
        {
            current = new BoxMark { A = e.Location, B = e.Location, Ellipse = tool == ToolMode.Ellipse, Fill = fillShapes, Color = drawColor, Width = drawWidth };
        }
        Capture = true;
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        if (!drawing && !selecting) return;
        if (tool == ToolMode.Eraser) { EraseAt(e.Location); return; }
        if (tool == ToolMode.Select && selecting)
        {
            var old = selectRect;
            selectRect = RectFromPoints(selectStart, e.Location);
            Invalidate(Rectangle.Union(Inflate(old, 6), Inflate(selectRect, 6)));
            return;
        }

        var oldBounds = CurrentBounds();
        if (current is PenMark pm)
        {
            var last = pm.Points[^1]; pm.Points.Add(e.Location);
            var r = Rectangle.FromLTRB(Math.Min(last.X, e.X), Math.Min(last.Y, e.Y), Math.Max(last.X, e.X), Math.Max(last.Y, e.Y));
            r.Inflate((int)Math.Ceiling(pm.Width) + 6, (int)Math.Ceiling(pm.Width) + 6); Invalidate(r); return;
        }
        if (current is LineMark lm) lm.B = e.Location;
        if (current is BoxMark bm) bm.B = e.Location;
        var newBounds = CurrentBounds();
        var u = Rectangle.Union(Rectangle.Round(oldBounds), Rectangle.Round(newBounds)); u.Inflate(8, 8); Invalidate(u);
    }

    protected override void OnMouseUp(MouseEventArgs e)
    {
        base.OnMouseUp(e);
        if (e.Button != MouseButtons.Left) return;
        if (tool == ToolMode.Select && selecting)
        {
            selecting = false; Capture = false;
            var region = selectRect; selectRect = Rectangle.Empty;
            if (region.Width >= 3 && region.Height >= 3) CopySelection(region);
            SetTool(ToolMode.Mouse); toolbar?.ShowTransientStatus("RECORTE COPIADO"); toolbar?.SyncState();
            return;
        }
        if (!drawing) return;
        drawing = false; Capture = false;
        if (tool != ToolMode.Eraser && current != null) marks.Add(current);
        current = null; Invalidate();
    }

    static Rectangle RectFromPoints(Point a, Point b) => Rectangle.FromLTRB(Math.Min(a.X, b.X), Math.Min(a.Y, b.Y), Math.Max(a.X, b.X), Math.Max(a.Y, b.Y));
    static Rectangle Inflate(Rectangle r, int amount) { if (r.IsEmpty) return Rectangle.Empty; r.Inflate(amount, amount); return r; }

    void CopySelection(Rectangle overlayRegion)
    {
        try
        {
            suppressPointer = true; Invalidate(Inflate(overlayRegion, 10)); Update(); Application.DoEvents();
            var vs = SystemInformation.VirtualScreen;
            var screenRegion = new Rectangle(overlayRegion.X + vs.Left, overlayRegion.Y + vs.Top, overlayRegion.Width, overlayRegion.Height);
            using var bmp = new Bitmap(screenRegion.Width, screenRegion.Height);
            using (var g = Graphics.FromImage(bmp)) g.CopyFromScreen(screenRegion.Location, Point.Empty, screenRegion.Size, CopyPixelOperation.SourceCopy);
            for (int i = 0; i < 4; i++)
            {
                try { Clipboard.SetImage((Bitmap)bmp.Clone()); break; }
                catch { Thread.Sleep(40); }
            }
        }
        finally { suppressPointer = false; Invalidate(); }
    }

    void EraseAt(Point p)
    {
        Rectangle dirty = new(p.X - 45, p.Y - 45, 90, 90);
        for (int i = marks.Count - 1; i >= 0; i--)
        {
            var r = marks[i].Bounds; r.Inflate(18, 18);
            if (r.Contains(p)) { dirty = Rectangle.Union(dirty, Rectangle.Round(marks[i].Bounds)); marks.RemoveAt(i); }
        }
        Invalidate(dirty);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        e.Graphics.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
        foreach (var m in marks) m.Draw(e.Graphics);
        current?.Draw(e.Graphics);
        if (selecting && !selectRect.IsEmpty) DrawSelection(e.Graphics, selectRect);
        DrawPointerDecoration(e.Graphics);
    }

    static void DrawSelection(Graphics g, Rectangle r)
    {
        using var fill = new SolidBrush(Color.FromArgb(40, 33, 150, 243));
        using var p1 = new Pen(Color.White, 3f) { DashStyle = DashStyle.Dash };
        using var p2 = new Pen(Color.FromArgb(33, 150, 243), 1.5f) { DashStyle = DashStyle.Dash };
        g.FillRectangle(fill, r); g.DrawRectangle(p1, r); g.DrawRectangle(p2, r);
    }

    void DrawPointerDecoration(Graphics g)
    {
        if (!active || suppressPointer || pointerStyle == PointerStyle.Off) return;
        var p = ScreenToOverlay(Cursor.Position);
        switch (pointerStyle)
        {
            case PointerStyle.Ring: DrawRing(g, p, 24, false); break;
            case PointerStyle.Target: DrawRing(g, p, 24, true); break;
            case PointerStyle.LargeRing: DrawRing(g, p, 38, false); break;
            case PointerStyle.HandSmall: DrawHand(g, p, 0.75f, pressedFrames > 0); break;
            case PointerStyle.HandMedium: DrawHand(g, p, 1.0f, pressedFrames > 0); break;
            case PointerStyle.HandLarge: DrawHand(g, p, 1.3f, pressedFrames > 0); break;
            case PointerStyle.PenMedium: DrawPenPointer(g, p, 1.0f, pressedFrames > 0); break;
            case PointerStyle.PenLarge: DrawPenPointer(g, p, 1.35f, pressedFrames > 0); break;
        }
        if (pulseFrames > 0)
        {
            var pp = ScreenToOverlay(pulseScreen);
            int grow = (10 - pulseFrames) * 4;
            using var pen = new Pen(Color.FromArgb(0, 188, 212), 3f);
            g.DrawEllipse(pen, pp.X - 24 - grow, pp.Y - 24 - grow, (24 + grow) * 2, (24 + grow) * 2);
        }
    }

    static void DrawRing(Graphics g, Point p, int r, bool target)
    {
        using var glow = new Pen(Color.FromArgb(60, 33, 150, 243), 9f);
        using var pen = new Pen(Color.FromArgb(33, 150, 243), 3.5f);
        g.DrawEllipse(glow, p.X - r, p.Y - r, r * 2, r * 2); g.DrawEllipse(pen, p.X - r, p.Y - r, r * 2, r * 2);
        if (!target) return;
        g.DrawLine(pen, p.X - r - 8, p.Y, p.X - 8, p.Y); g.DrawLine(pen, p.X + 8, p.Y, p.X + r + 8, p.Y);
        g.DrawLine(pen, p.X, p.Y - r - 8, p.X, p.Y - 8); g.DrawLine(pen, p.X, p.Y + 8, p.X, p.Y + r + 8);
    }

    static void DrawHand(Graphics g, Point p, float s, bool pressed)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        float shift = pressed ? 4f * s : 0f;
        var pts = new[]
        {
            new PointF(p.X + 2*s, p.Y + 2*s + shift), new PointF(p.X + 2*s, p.Y - 20*s + shift),
            new PointF(p.X + 8*s, p.Y - 20*s + shift), new PointF(p.X + 8*s, p.Y - 4*s + shift),
            new PointF(p.X + 12*s, p.Y - 14*s + shift), new PointF(p.X + 18*s, p.Y - 12*s + shift),
            new PointF(p.X + 19*s, p.Y - 3*s + shift), new PointF(p.X + 23*s, p.Y - 10*s + shift),
            new PointF(p.X + 29*s, p.Y - 7*s + shift), new PointF(p.X + 29*s, p.Y + 7*s + shift),
            new PointF(p.X + 22*s, p.Y + 20*s + shift), new PointF(p.X + 7*s, p.Y + 20*s + shift),
            new PointF(p.X - 5*s, p.Y + 7*s + shift), new PointF(p.X - 4*s, p.Y + 2*s + shift)
        };
        using var path = new GraphicsPath(); path.AddPolygon(pts);
        using var shadow = new SolidBrush(Color.FromArgb(100, 0, 0, 0));
        var shadowPts = Array.ConvertAll(pts, q => new PointF(q.X + 3, q.Y + 3)); using var shadowPath = new GraphicsPath(); shadowPath.AddPolygon(shadowPts); g.FillPath(shadow, shadowPath);
        using var fill = new SolidBrush(Color.White); using var outline = new Pen(Color.FromArgb(30, 30, 30), Math.Max(2f, 2.2f*s));
        g.FillPath(fill, path); g.DrawPath(outline, path);
        if (pressed)
        {
            using var click = new Pen(Color.FromArgb(33, 150, 243), 3f);
            g.DrawArc(click, p.X - 13*s, p.Y - 31*s, 28*s, 18*s, 205, 130);
        }
    }

    static void DrawPenPointer(Graphics g, Point p, float s, bool pressed)
    {
        float a = pressed ? 4f*s : 0f;
        using var body = new Pen(Color.White, 8f*s) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        using var edge = new Pen(Color.FromArgb(30,30,30), 11f*s) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        var a1 = new PointF(p.X + 2*s, p.Y + 2*s + a); var b1 = new PointF(p.X + 29*s, p.Y - 29*s + a);
        g.DrawLine(edge, a1, b1); g.DrawLine(body, a1, b1);
        using var tip = new SolidBrush(Color.FromArgb(33,150,243)); g.FillEllipse(tip, p.X - 4*s, p.Y - 4*s + a, 9*s, 9*s);
    }

    protected override void Dispose(bool disposing)
    {
        SystemEvents.DisplaySettingsChanged -= DisplaySettingsChanged;
        StopHook(); pointerTimer.Dispose(); EnsureNativeCursorVisible();
        base.Dispose(disposing);
    }
}

sealed class ToolbarForm : Form
{
    readonly OverlayForm overlay;
    readonly Dictionary<ToolMode, Button> toolButtons = new();
    readonly Color selected = Color.FromArgb(210, 232, 255);
    readonly Color normal = Color.FromArgb(246, 246, 246);
    readonly Color dark = Color.FromArgb(27, 31, 39);
    Label status = null!;
    ComboBox pointerBox = null!;
    NumericUpDown widthBox = null!;
    CheckBox fillBox = null!;
    bool internalMinimize;
    bool startupMinimized;
    bool movingFromSaved;
    readonly System.Windows.Forms.Timer transientTimer = new();

    const int HK_F1 = 1, HK_F2 = 2, HK_F3 = 3, HK_F4 = 4, HK_F5 = 5, HK_F6 = 6, HK_F7 = 7, HK_F8 = 8, HK_F9 = 9;
    const int HK_PEN = 10, HK_LINE = 11, HK_ARROW = 12, HK_TEXT = 13, HK_ERASE = 14, HK_UNDO = 15, HK_CLEAR = 16;

    public ToolbarForm(OverlayForm o, Icon appIcon, bool startup)
    {
        overlay = o; overlay.AttachToolbar(this); Icon = appIcon; startupMinimized = startup;
        Text = "PELEGO Marcador de Tela";
        Width = 206; Height = 742;
        FormBorderStyle = FormBorderStyle.FixedSingle; MaximizeBox = false; MinimizeBox = true;
        ShowInTaskbar = true; TopMost = true; StartPosition = FormStartPosition.Manual;
        Font = new Font("Segoe UI", 9f);
        BuildUi(); LoadToolbarPosition();
        transientTimer.Interval = 1800; transientTimer.Tick += (_, _) => { transientTimer.Stop(); SyncState(); };
        Shown += (_, _) =>
        {
            if (startupMinimized) CleanAndMinimize(false); else { overlay.ActivateProgram(); SyncState(); }
        };
        Move += (_, _) => SaveToolbarPosition();
    }

    void BuildUi()
    {
        var header = new Panel { BackColor = dark }; header.SetBounds(0, 0, ClientSize.Width, 58); header.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right; Controls.Add(header);
        var title = new Label { Text = "PELEGO MARCADOR", ForeColor = Color.White, Font = new Font("Segoe UI", 10f, FontStyle.Bold), TextAlign = ContentAlignment.MiddleCenter };
        title.SetBounds(4, 4, 188, 24); header.Controls.Add(title);
        status = new Label { TextAlign = ContentAlignment.MiddleCenter, Font = new Font("Segoe UI", 8.2f, FontStyle.Bold) }; status.SetBounds(5, 30, 186, 21); header.Controls.Add(status);

        int y = 66;
        AddToolButton("MOUSE / USAR WINDOWS", ToolMode.Mouse, y, 180, 33); y += 40;
        AddSectionLabel("DESTAQUE DO PONTEIRO", y); y += 18;
        pointerBox = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList };
        pointerBox.Items.AddRange(new object[] { "Desligado (F1)", "Anel azul (F2)", "Alvo azul (F6)", "Anel grande", "Mão pequena", "Mão média (F3)", "Mão grande (F4)", "Caneta média", "Caneta grande (F5)" });
        pointerBox.SetBounds(12, y, 174, 26); pointerBox.SelectedIndexChanged += (_, _) => { if (pointerBox.SelectedIndex >= 0) overlay.SetPointerStyle((PointerStyle)pointerBox.SelectedIndex); }; Controls.Add(pointerBox); y += 34;

        AddToolButton("CANETA", ToolMode.Pen, y); y += 33;
        AddToolButton("MARCA-TEXTO", ToolMode.Highlighter, y); y += 33;
        AddToolButton("LINHA", ToolMode.Line, y); y += 33;
        AddToolButton("SETA", ToolMode.Arrow, y); y += 33;
        AddToolButton("RETÂNGULO", ToolMode.Rectangle, y); y += 33;
        AddToolButton("CÍRCULO / ELIPSE", ToolMode.Ellipse, y); y += 33;
        AddToolButton("TEXTO", ToolMode.Text, y); y += 33;
        AddToolButton("BORRACHA", ToolMode.Eraser, y); y += 33;
        AddToolButton("SELECIONAR / COPIAR  F7", ToolMode.Select, y); y += 38;

        AddSectionLabel("FORMA", y); y += 18;
        fillBox = new CheckBox { Text = "PREENCHIDA", AutoSize = false, TextAlign = ContentAlignment.MiddleLeft };
        fillBox.SetBounds(12, y, 174, 24); fillBox.CheckedChanged += (_, _) => overlay.SetFill(fillBox.Checked); Controls.Add(fillBox); y += 28;

        AddSectionLabel("COR", y); y += 19;
        Color[] colors =
        {
            Color.FromArgb(33,150,243), Color.FromArgb(0,188,212), Color.FromArgb(0,200,83), Color.FromArgb(118,255,3), Color.FromArgb(255,214,0),
            Color.FromArgb(255,109,0), Color.FromArgb(244,67,54), Color.FromArgb(233,30,99), Color.White, Color.Black
        };
        for (int i = 0; i < colors.Length; i++)
        {
            var b = new Button { BackColor = colors[i], FlatStyle = FlatStyle.Flat, TabStop = false };
            b.FlatAppearance.BorderColor = Color.Gray;
            int row = i / 5, col = i % 5; b.SetBounds(12 + col * 35, y + row * 28, 30, 24);
            var cc = colors[i]; b.Click += (_, _) => overlay.SetColor(cc); Controls.Add(b);
        }
        y += 60;

        AddSectionLabel("ESPESSURA", y); y += 18;
        widthBox = new NumericUpDown { Minimum = 1, Maximum = 20, Value = 3, DecimalPlaces = 0, TextAlign = HorizontalAlignment.Center };
        widthBox.SetBounds(12, y, 70, 27); widthBox.ValueChanged += (_, _) => overlay.SetWidth((float)widthBox.Value); Controls.Add(widthBox);
        var thin = FlatButton("1"); thin.SetBounds(88, y, 28, 27); thin.Click += (_, _) => widthBox.Value = 1; Controls.Add(thin);
        var medium = FlatButton("3"); medium.SetBounds(120, y, 28, 27); medium.Click += (_, _) => widthBox.Value = 3; Controls.Add(medium);
        var thick = FlatButton("8"); thick.SetBounds(152, y, 28, 27); thick.Click += (_, _) => widthBox.Value = 8; Controls.Add(thick); y += 34;

        var undo = FlatButton("DESFAZER"); undo.SetBounds(12, y, 84, 30); undo.Click += (_, _) => overlay.Undo(); Controls.Add(undo);
        var clear = FlatButton("LIMPAR"); clear.SetBounds(102, y, 84, 30); clear.Click += (_, _) => overlay.ClearAll(); Controls.Add(clear); y += 36;

        var hint = new Label
        {
            Text = "F1 off  F2 anel  F3/F4 mão  F5 caneta\nF6 alvo  F7 recorte  F8 barra  F9 mouse",
            ForeColor = Color.DimGray, Font = new Font("Segoe UI", 7.4f), TextAlign = ContentAlignment.MiddleCenter
        };
        hint.SetBounds(8, y, 182, 38); Controls.Add(hint);
    }

    void AddSectionLabel(string text, int y)
    {
        var l = new Label { Text = text, Font = new Font("Segoe UI", 7.4f, FontStyle.Bold), ForeColor = Color.FromArgb(75,75,75) };
        l.SetBounds(12, y, 174, 18); Controls.Add(l);
    }
    Button FlatButton(string text) => new() { Text = text, FlatStyle = FlatStyle.Flat, BackColor = normal, Font = new Font("Segoe UI", 8.2f, FontStyle.Bold) };
    void AddToolButton(string text, ToolMode mode, int y, int width = 174, int height = 29)
    {
        var b = FlatButton(text); b.SetBounds(12, y, width, height); b.FlatAppearance.BorderColor = Color.Silver;
        b.Click += (_, _) => { overlay.SetTool(mode); SyncState(); }; Controls.Add(b); toolButtons[mode] = b;
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        Native.RegisterHotKey(Handle, HK_F1, 0, (int)Keys.F1); Native.RegisterHotKey(Handle, HK_F2, 0, (int)Keys.F2);
        Native.RegisterHotKey(Handle, HK_F3, 0, (int)Keys.F3); Native.RegisterHotKey(Handle, HK_F4, 0, (int)Keys.F4);
        Native.RegisterHotKey(Handle, HK_F5, 0, (int)Keys.F5); Native.RegisterHotKey(Handle, HK_F6, 0, (int)Keys.F6);
        Native.RegisterHotKey(Handle, HK_F7, 0, (int)Keys.F7); Native.RegisterHotKey(Handle, HK_F8, 0, (int)Keys.F8);
        Native.RegisterHotKey(Handle, HK_F9, 0, (int)Keys.F9);
        Native.RegisterHotKey(Handle, HK_PEN, Native.MOD_CONTROL | Native.MOD_ALT, (int)Keys.D2);
        Native.RegisterHotKey(Handle, HK_LINE, Native.MOD_CONTROL | Native.MOD_ALT, (int)Keys.D3);
        Native.RegisterHotKey(Handle, HK_ARROW, Native.MOD_CONTROL | Native.MOD_ALT, (int)Keys.D4);
        Native.RegisterHotKey(Handle, HK_TEXT, Native.MOD_CONTROL | Native.MOD_ALT, (int)Keys.T);
        Native.RegisterHotKey(Handle, HK_ERASE, Native.MOD_CONTROL | Native.MOD_ALT, (int)Keys.E);
        Native.RegisterHotKey(Handle, HK_UNDO, Native.MOD_CONTROL | Native.MOD_ALT, (int)Keys.Z);
        Native.RegisterHotKey(Handle, HK_CLEAR, Native.MOD_CONTROL | Native.MOD_ALT, (int)Keys.C);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Native.WM_HOTKEY)
        {
            int id = m.WParam.ToInt32();
            if (id == HK_F8) { if (WindowState == FormWindowState.Minimized) RestoreToolbar(); else CleanAndMinimize(true); return; }
            if (id == HK_F1) overlay.SetPointerStyle(PointerStyle.Off);
            else if (id == HK_F2) overlay.SetPointerStyle(PointerStyle.Ring);
            else if (id == HK_F3) overlay.SetPointerStyle(PointerStyle.HandMedium);
            else if (id == HK_F4) overlay.SetPointerStyle(PointerStyle.HandLarge);
            else if (id == HK_F5) overlay.SetPointerStyle(PointerStyle.PenLarge);
            else if (id == HK_F6) overlay.SetPointerStyle(PointerStyle.Target);
            else if (id == HK_F7) overlay.SetTool(ToolMode.Select);
            else if (id == HK_F9) overlay.SetTool(ToolMode.Mouse);
            else if (id == HK_PEN) overlay.SetTool(ToolMode.Pen);
            else if (id == HK_LINE) overlay.SetTool(ToolMode.Line);
            else if (id == HK_ARROW) overlay.SetTool(ToolMode.Arrow);
            else if (id == HK_TEXT) overlay.SetTool(ToolMode.Text);
            else if (id == HK_ERASE) overlay.SetTool(ToolMode.Eraser);
            else if (id == HK_UNDO) overlay.Undo();
            else if (id == HK_CLEAR) overlay.ClearAll();
            SyncState(); return;
        }
        base.WndProc(ref m);
    }

    public void SyncState()
    {
        foreach (var kv in toolButtons) kv.Value.BackColor = kv.Key == overlay.CurrentTool ? selected : normal;
        bool mouse = overlay.CurrentTool == ToolMode.Mouse;
        status.Text = overlay.ProgramActive ? (mouse ? "MOUSE LIVRE" : "DESENHO ATIVO") : "EM ESPERA";
        status.ForeColor = overlay.ProgramActive ? (mouse ? Color.FromArgb(120, 235, 150) : Color.FromArgb(105, 190, 255)) : Color.Silver;
        int pi = (int)overlay.PointerStyle; if (pointerBox.SelectedIndex != pi) pointerBox.SelectedIndex = pi;
        decimal dw = (decimal)Math.Clamp(overlay.DrawWidth, 1f, 20f); if (widthBox.Value != dw) widthBox.Value = dw;
        if (fillBox.Checked != overlay.FillShapes) fillBox.Checked = overlay.FillShapes;
        TopMost = true; BringToFront();
    }

    public void ShowTransientStatus(string text)
    {
        status.Text = text; status.ForeColor = Color.FromArgb(120,235,150); transientTimer.Stop(); transientTimer.Start();
    }

    public void RestoreToolbar()
    {
        internalMinimize = true;
        ShowInTaskbar = true;
        WindowState = FormWindowState.Normal;
        Show();
        internalMinimize = false;
        overlay.ActivateProgram();
        TopMost = true; Activate(); BringToFront(); SyncState();
    }

    void CleanAndMinimize(bool userAction)
    {
        overlay.DeactivateAndReset();
        internalMinimize = true;
        ShowInTaskbar = true;
        WindowState = FormWindowState.Minimized;
        internalMinimize = false;
        if (userAction) SyncState();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true; CleanAndMinimize(true); return;
        }
        base.OnFormClosing(e);
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        if (internalMinimize) return;
        if (WindowState == FormWindowState.Minimized) { overlay.DeactivateAndReset(); return; }
        if (WindowState == FormWindowState.Normal && Visible) { overlay.ActivateProgram(); SyncState(); }
    }

    void LoadToolbarPosition()
    {
        try
        {
            using var k = Registry.CurrentUser.OpenSubKey(@"Software\PELEGO\MarcadorTelaV2");
            int x = Convert.ToInt32(k?.GetValue("ToolbarX", int.MinValue)); int y = Convert.ToInt32(k?.GetValue("ToolbarY", int.MinValue));
            if (x != int.MinValue && y != int.MinValue)
            {
                var pt = new Point(x, y);
                foreach (var s in Screen.AllScreens) if (s.WorkingArea.Contains(pt)) { Location = pt; movingFromSaved = true; return; }
            }
        }
        catch { }
        var wa = Screen.PrimaryScreen?.WorkingArea ?? SystemInformation.WorkingArea;
        Left = wa.Right - Width - 12; Top = Math.Max(10, wa.Top + (wa.Height - Height) / 2);
    }

    void SaveToolbarPosition()
    {
        if (WindowState != FormWindowState.Normal || !Visible) return;
        try
        {
            using var k = Registry.CurrentUser.CreateSubKey(@"Software\PELEGO\MarcadorTelaV2");
            k.SetValue("ToolbarX", Left, RegistryValueKind.DWord); k.SetValue("ToolbarY", Top, RegistryValueKind.DWord);
        }
        catch { }
        movingFromSaved = false;
    }

    protected override void Dispose(bool disposing)
    {
        if (IsHandleCreated) for (int i = HK_F1; i <= HK_CLEAR; i++) Native.UnregisterHotKey(Handle, i);
        transientTimer.Dispose(); base.Dispose(disposing);
    }
}

static class Program
{
    static Mutex? mutex;
    static Icon AppIcon()
    {
        try { return Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application; }
        catch { return SystemIcons.Application; }
    }

    [STAThread]
    static void Main(string[] args)
    {
        bool created;
        mutex = new Mutex(true, "PELEGO_MARCADOR_TELA_V2_SINGLE_INSTANCE", out created);
        if (!created)
        {
            var h = Native.FindWindow(null, "PELEGO Marcador de Tela");
            if (h != IntPtr.Zero) { Native.ShowWindow(h, Native.SW_RESTORE); Native.SetForegroundWindow(h); }
            return;
        }
        Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
        var icon = AppIcon();
        var overlay = new OverlayForm(); overlay.LoadSettings();
        bool startup = args != null && Array.Exists(args, s => string.Equals(s, "/startup", StringComparison.OrdinalIgnoreCase));
        var toolbar = new ToolbarForm(overlay, icon, startup);
        Application.Run(toolbar);
        overlay.Dispose();
        if (icon != SystemIcons.Application) icon.Dispose();
        mutex.ReleaseMutex(); mutex.Dispose();
    }
}
