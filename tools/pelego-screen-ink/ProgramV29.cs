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

namespace PelegoMarkerV2;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // Mantém o mesmo mutex da 2.8 para impedir duas versões rodando juntas.
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
    const int HOTKEY_F6 = 2016;
    const int HOTKEY_F10 = 2021;
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
        Text = "PELEGO Marcador de Tela 2.9";
        Width = 735;
        Height = 575;
        MinimumSize = new Size(735, 575);
        MaximumSize = new Size(735, 575);
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

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 3,
            RowCount = 2,
            Padding = new Padding(10),
            BackColor = Color.FromArgb(245, 245, 247),
            AutoScroll = false
        };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.333f));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.333f));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.334f));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        Controls.Add(root);

        var header = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1,
            Margin = new Padding(0),
            BackColor = Color.FromArgb(245, 245, 247)
        };
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        root.Controls.Add(header, 0, 0);
        root.SetColumnSpan(header, 3);

        var title = new Label
        {
            Text = "PELEGO  •  MARCADOR  2.9",
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            Font = new Font(Font.FontFamily, 11f, FontStyle.Bold),
            Margin = new Padding(6, 4, 6, 4)
        };
        header.Controls.Add(title, 0, 0);

        status = new Label
        {
            Text = "MOUSE LIVRE",
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            BackColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle,
            Font = new Font(Font.FontFamily, 9f, FontStyle.Bold),
            Margin = new Padding(6, 8, 6, 8)
        };
        header.Controls.Add(status, 1, 0);

        var tools = ColumnPanel();
        var style = ColumnPanel();
        var pointer = ColumnPanel();
        root.Controls.Add(tools, 0, 1);
        root.Controls.Add(style, 1, 1);
        root.Controls.Add(pointer, 2, 1);

        tools.Controls.Add(Section("FERRAMENTAS"));
        AddTool(tools, "Mouse / Windows", ToolMode.Mouse);
        AddTool(tools, "Caneta", ToolMode.Pen);
        AddTool(tools, "Marca-texto", ToolMode.Highlighter);
        AddTool(tools, "Linha", ToolMode.Line);
        AddTool(tools, "Seta", ToolMode.Arrow);
        AddTool(tools, "Retângulo", ToolMode.Rectangle);
        AddTool(tools, "Elipse", ToolMode.Ellipse);
        AddTool(tools, "Texto", ToolMode.Text);
        AddTool(tools, "Borracha", ToolMode.Eraser);
        AddTool(tools, "Selecionar / Copiar  [F7]", ToolMode.Select);

        var undoRow = new FlowLayoutPanel { Width = 212, Height = 34, WrapContents = false, Margin = new Padding(3) };
        var undo = SmallButton("↶ Desfazer", 101);
        undo.Click += (_, _) => canvas.Undo();
        var clear = SmallButton("✕ Limpar", 101);
        clear.Click += (_, _) => canvas.ClearAll();
        undoRow.Controls.Add(undo);
        undoRow.Controls.Add(clear);
        tools.Controls.Add(undoRow);

        style.Controls.Add(Section("TRAÇO"));
        var strokeRow = new FlowLayoutPanel { Width = 212, Height = 36, WrapContents = false, Margin = new Padding(3) };
        strokeRow.Controls.Add(new Label { Text = "Espessura", Width = 105, Height = 28, TextAlign = ContentAlignment.MiddleLeft });
        thickness = new NumericUpDown { Minimum = 1, Maximum = 30, Value = 3, Width = 78, Height = 28 };
        strokeRow.Controls.Add(thickness);
        style.Controls.Add(strokeRow);

        filled = new CheckBox { Text = "Preencher retângulo / elipse", Width = 212, Height = 28, Margin = new Padding(3) };
        style.Controls.Add(filled);

        style.Controls.Add(Section("CORES"));
        var colors = new FlowLayoutPanel { Width = 212, Height = 70, WrapContents = true, Margin = new Padding(3) };
        foreach (var c in new[]
        {
            Color.FromArgb(0,120,255), Color.Red, Color.FromArgb(255,120,0), Color.Gold,
            Color.LimeGreen, Color.DeepSkyBlue, Color.White, Color.Black
        }) AddColor(colors, c);
        style.Controls.Add(colors);

        style.Controls.Add(Section("COMO USAR"));
        var help = new Label
        {
            Text = "F8 abre/minimiza\r\nF9 SOLTA TUDO\r\nCtrl+Alt+F12 emergência\r\nBotão direito solta a ferramenta\r\nF5 fica livre para Windows/navegador\r\nX fecha e deixa o marcador inativo",
            Width = 212,
            Height = 126,
            BackColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle,
            Padding = new Padding(7),
            Margin = new Padding(3)
        };
        style.Controls.Add(help);

        pointer.Controls.Add(Section("PONTEIRO"));
        AddPointer(pointer, "F1  Desligado", PointerMode.Off);
        AddPointer(pointer, "F2  Anel", PointerMode.Ring);
        AddPointer(pointer, "F3  Anel grande", PointerMode.BigRing);
        AddPointer(pointer, "F4  Alvo", PointerMode.Target);
        AddPointer(pointer, "F10  Mão", PointerMode.Hand);
        AddPointer(pointer, "F6  Mira / caneta", PointerMode.Cross);

        pointer.Controls.Add(Section("LEGENDA"));
        pointer.Controls.Add(new Label
        {
            Text = "Caneta, marca-texto, linha, seta, formas, texto, borracha e seleção capturam o mouse na tela inteira.\r\n\r\nPara voltar ao Windows na hora: botão direito ou F9.",
            Width = 212,
            Height = 132,
            BackColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle,
            Padding = new Padding(7),
            Margin = new Padding(3)
        });

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
            Native.RestoreSystemCursors();
            BringToFront();
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

    FlowLayoutPanel ColumnPanel() => new()
    {
        Dock = DockStyle.Fill,
        FlowDirection = FlowDirection.TopDown,
        WrapContents = false,
        AutoScroll = false,
        Padding = new Padding(4),
        Margin = new Padding(3),
        BackColor = Color.FromArgb(245, 245, 247)
    };

    Label Section(string text) => new()
    {
        Text = text,
        Width = 212,
        Height = 21,
        TextAlign = ContentAlignment.BottomLeft,
        Font = new Font(Font.FontFamily, 8.5f, FontStyle.Bold),
        ForeColor = Color.FromArgb(80, 80, 80),
        Margin = new Padding(3, 3, 3, 1)
    };

    Button SmallButton(string text, int width) => new()
    {
        Text = text,
        Width = width,
        Height = 28,
        FlatStyle = FlatStyle.System,
        Margin = new Padding(2)
    };

    void AddTool(Control parent, string text, ToolMode mode)
    {
        var b = new Button
        {
            Text = text,
            Width = 212,
            Height = 29,
            TextAlign = ContentAlignment.MiddleLeft,
            Margin = new Padding(3, 2, 3, 2)
        };
        b.Click += (_, _) => SetTool(mode);
        parent.Controls.Add(b);
        toolButtons[mode] = b;
    }

    void AddPointer(Control parent, string text, PointerMode mode)
    {
        var b = new Button
        {
            Text = text,
            Width = 212,
            Height = 31,
            TextAlign = ContentAlignment.MiddleLeft,
            Margin = new Padding(3, 2, 3, 2)
        };
        b.Click += (_, _) => SetPointer(mode);
        parent.Controls.Add(b);
        pointerButtons[mode] = b;
    }

    void AddColor(Control parent, Color c)
    {
        var b = new Button { Width = 43, Height = 28, BackColor = c, FlatStyle = FlatStyle.Flat, Text = "", Margin = new Padding(4, 2, 4, 2) };
        if (c == Color.White) b.FlatAppearance.BorderColor = Color.Gray;
        b.Click += (_, _) =>
        {
            inkColor = c;
            foreach (var x in colorButtons) x.FlatAppearance.BorderSize = 1;
            b.FlatAppearance.BorderSize = 3;
            canvas.Invalidate();
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
            PrepareSelectionSnapshot();

        toolMode = mode;
        canvas.SetMode(mode);
        canvas.SetInteractive(true);
        status.Text = mode switch
        {
            ToolMode.Select => "SELECIONE UMA ÁREA",
            ToolMode.Pen => "CANETA ATIVA",
            ToolMode.Highlighter => "MARCA-TEXTO ATIVO",
            ToolMode.Eraser => "BORRACHA ATIVA",
            _ => mode.ToString().ToUpperInvariant()
        };
        UpdateToolButtons();
        BringToFront();
    }

    void SetPointer(PointerMode mode)
    {
        RestoreFromTaskbar();
        pointerMode = mode;
        // A 2.8 trocava o cursor do Windows inteiro. Isso falhava em navegadores e ainda podia deixar o cursor alterado.
        // Na 2.9 mão/mira são desenhadas pelo overlay, sem sequestrar cursores do sistema.
        Native.RestoreSystemCursors();
        UpdatePointerButtons();
        canvas.Invalidate();
        BringToFront();
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

    public bool IsToolbarPoint(Point screenPoint) =>
        Visible && WindowState == FormWindowState.Normal && Bounds.Contains(screenPoint);

    public void ReleaseDrawingOnly()
    {
        toolMode = ToolMode.Mouse;
        canvas.SetMode(ToolMode.Mouse);
        canvas.SetInteractive(false);
        status.Text = "MOUSE LIVRE";
        UpdateToolButtons();
        BringToFront();
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
        if (!canvas.Visible) canvas.Show();
        canvas.SetInteractive(toolMode != ToolMode.Mouse);
        BringToFront();
        Activate();
    }

    void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
    {
        e.Cancel = true;
        DeactivateAndMinimize();
    }

    void MainForm_Resize(object? sender, EventArgs e)
    {
        if (WindowState == FormWindowState.Minimized)
        {
            canvas.SetInteractive(false);
            canvas.Hide();
            return;
        }

        if (!canvas.Visible) canvas.Show();
        canvas.SetInteractive(toolMode != ToolMode.Mouse);
        BringToFront();
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
        UnregisterGlobalHotkeys();
        Native.RegisterHotKey(Handle, HOTKEY_F8, 0, (uint)Keys.F8);
        Native.RegisterHotKey(Handle, HOTKEY_F9, 0, (uint)Keys.F9);
        Native.RegisterHotKey(Handle, HOTKEY_F7, 0, (uint)Keys.F7);
        Native.RegisterHotKey(Handle, HOTKEY_F1, 0, (uint)Keys.F1);
        Native.RegisterHotKey(Handle, HOTKEY_F2, 0, (uint)Keys.F2);
        Native.RegisterHotKey(Handle, HOTKEY_F3, 0, (uint)Keys.F3);
        Native.RegisterHotKey(Handle, HOTKEY_F4, 0, (uint)Keys.F4);
        Native.RegisterHotKey(Handle, HOTKEY_F6, 0, (uint)Keys.F6);
        Native.RegisterHotKey(Handle, HOTKEY_F10, 0, (uint)Keys.F10);
        Native.RegisterHotKey(Handle, HOTKEY_PANIC, Native.MOD_CONTROL | Native.MOD_ALT, (uint)Keys.F12);
        // F5 propositalmente NÃO é registrado. Continua sendo F5 normal do Windows/navegador.
    }

    void UnregisterGlobalHotkeys()
    {
        foreach (var id in new[] { HOTKEY_F8, HOTKEY_F9, HOTKEY_F7, HOTKEY_F1, HOTKEY_F2, HOTKEY_F3, HOTKEY_F4, HOTKEY_F6, HOTKEY_F10, HOTKEY_PANIC })
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
            if (id == HOTKEY_F6) { SetPointer(PointerMode.Cross); return; }
            if (id == HOTKEY_F10) { SetPointer(PointerMode.Hand); return; }
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
        var canvasWasVisible = canvas.Visible;

        Opacity = 0;
        pointerMode = PointerMode.Off;
        canvas.SetInteractive(false);
        canvas.Hide();
        Application.DoEvents();
        System.Threading.Thread.Sleep(55);

        var vs = SystemInformation.VirtualScreen;
        var bmp = new Bitmap(vs.Width, vs.Height, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
            g.CopyFromScreen(vs.Left, vs.Top, 0, 0, vs.Size, CopyPixelOperation.SourceCopy);
        selectionSnapshot = bmp;

        if (canvasWasVisible) canvas.Show();
        Opacity = oldOpacity;
        pointerMode = oldPointer;
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
            var p = new Point(40, 80);
            if (k?.GetValue("X") is int x && k.GetValue("Y") is int y) p = new Point(x, y);

            var screen = Screen.FromPoint(p).WorkingArea;
            var safeX = Math.Clamp(p.X, screen.Left, Math.Max(screen.Left, screen.Right - Width));
            var safeY = Math.Clamp(p.Y, screen.Top, Math.Max(screen.Top, screen.Bottom - Height));
            Location = new Point(safeX, safeY);
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
            // O overlay visual fica SEMPRE click-through. O desenho recebe mouse pelo hook global.
            // Isso resolve o defeito da 2.8: TransparencyKey fazia a área vazia não receber clique nenhum.
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
        catch
        {
            mouseHook = IntPtr.Zero;
        }
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

        // Nunca sequestra clique dentro da própria barra de ferramentas.
        if (owner.IsToolbarPoint(screenPoint))
            return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);

        var msg = wParam.ToInt32();
        var local = new Point(screenPoint.X - Left, screenPoint.Y - Top);

        if (msg == Native.WM_RBUTTONDOWN)
        {
            try { BeginInvoke(new Action(owner.ReleaseDrawingOnly)); } catch { }
            return (IntPtr)1;
        }
        if (msg == Native.WM_RBUTTONUP)
            return (IntPtr)1;

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
                current = new StrokeShape(Color.FromArgb(100, owner.InkColor), Math.Max(10, owner.InkWidth * 4), p);
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

    public Rectangle GetHaloScreenBounds(Point cursor)
    {
        if (owner.CurrentPointer == PointerMode.Off || !Visible) return Rectangle.Empty;
        var r = owner.CurrentPointer switch
        {
            PointerMode.BigRing => 56,
            PointerMode.Hand => 50,
            PointerMode.Target => 50,
            PointerMode.Cross => 50,
            _ => 40
        };
        if (owner.PulseActive) r += 38;
        return new Rectangle(cursor.X - r - 8, cursor.Y - r - 8, (r + 8) * 2, (r + 8) * 2);
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
        var radius = pm == PointerMode.BigRing ? 38 : 25;
        using var pen = new Pen(Color.FromArgb(0, 120, 255), 4) { StartCap = LineCap.Round, EndCap = LineCap.Round };

        switch (pm)
        {
            case PointerMode.Ring:
            case PointerMode.BigRing:
                g.DrawEllipse(pen, p.X - radius, p.Y - radius, radius * 2, radius * 2);
                break;

            case PointerMode.Target:
                g.DrawEllipse(pen, p.X - radius, p.Y - radius, radius * 2, radius * 2);
                g.DrawLine(pen, p.X - radius - 12, p.Y, p.X + radius + 12, p.Y);
                g.DrawLine(pen, p.X, p.Y - radius - 12, p.X, p.Y + radius + 12);
                break;

            case PointerMode.Hand:
                g.DrawEllipse(pen, p.X - radius, p.Y - radius, radius * 2, radius * 2);
                try { Cursors.Hand.Draw(g, new Rectangle(p.X + 8, p.Y + 8, 32, 32)); }
                catch
                {
                    g.DrawLine(pen, p.X + 8, p.Y + 8, p.X + 8, p.Y + 30);
                    g.DrawLine(pen, p.X + 8, p.Y + 18, p.X + 22, p.Y + 18);
                }
                break;

            case PointerMode.Cross:
                g.DrawEllipse(pen, p.X - radius, p.Y - radius, radius * 2, radius * 2);
                g.DrawLine(pen, p.X - 36, p.Y, p.X - 8, p.Y);
                g.DrawLine(pen, p.X + 8, p.Y, p.X + 36, p.Y);
                g.DrawLine(pen, p.X, p.Y - 36, p.X, p.Y - 8);
                g.DrawLine(pen, p.X, p.Y + 8, p.X, p.Y + 36);
                using (var dot = new SolidBrush(Color.FromArgb(0, 120, 255)))
                    g.FillEllipse(dot, p.X - 3, p.Y - 3, 6, 6);
                break;
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
        Width = 350;
        Height = 135;
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        TopMost = true;
        box = new TextBox { Left = 10, Top = 10, Width = 315, Height = 28, Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 12), ForeColor = color };
        var ok = new Button { Text = "Inserir", Left = 165, Top = 50, Width = 78, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancelar", Left = 247, Top = 50, Width = 78, DialogResult = DialogResult.Cancel };
        Controls.Add(box);
        Controls.Add(ok);
        Controls.Add(cancel);
        AcceptButton = ok;
        CancelButton = cancel;
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
    const uint SPI_SETCURSORS = 0x0057;

    public delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT
    {
        public int X;
        public int Y;
    }

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
    [DllImport("user32.dll", SetLastError = true)] static extern bool SystemParametersInfo(uint action, uint param, IntPtr pvParam, uint flags);

    public static void RestoreSystemCursors()
    {
        try { SystemParametersInfo(SPI_SETCURSORS, 0, IntPtr.Zero, 0); } catch { }
    }
}
