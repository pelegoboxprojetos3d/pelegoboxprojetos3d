using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;
using Microsoft.Win32;

namespace PelegoMarkerV32;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        using var mutex = new System.Threading.Mutex(true, "PELEGO_MARCADOR_DE_TELA_SINGLE", out var first);
        if (!first) return;

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        var startup = args.Any(a => a.Equals("/startup", StringComparison.OrdinalIgnoreCase));
        Application.Run(new MainForm(startup));
    }
}

enum ToolMode
{
    Mouse, Pen, Eraser, Line, Arrow, DoubleArrow,
    RectOutline, RectFill, EllipseOutline, EllipseFill,
    Select, Text, Emoji
}

enum PointerMode { Off, Ring, Target, Hand, Pen }

enum GlyphKind
{
    Pen, Eraser, Line, Arrow, DoubleArrow,
    RectOutline, RectFill, EllipseOutline, EllipseFill,
    Select, Text, Emoji,
    Ring, Target, Hand, PointerPen,
    Undo, Trash, New, Copy, Print, Save
}

sealed class MainForm : Form
{
    // REGRA VISUAL APROVADA: launcher 62x61 e paleta 62x655, como o Pointofix de referência.
    const int LauncherWidth = 62;
    const int LauncherHeight = 61;
    const int PaletteWidth = 62;
    const int PaletteHeight = 655;
    const int HOTKEY_PANIC = 4200;
    const int HOTKEY_COPY = 4201;

    readonly CanvasForm canvas;
    readonly ToolTip tips = new();
    readonly Dictionary<ToolMode, GlyphButton> toolButtons = new();
    readonly Dictionary<PointerMode, GlyphButton> pointerButtons = new();
    readonly List<ColorButton> colorButtons = new();
    readonly List<ThicknessButton> thicknessButtons = new();
    readonly System.Windows.Forms.Timer pointerTimer;

    readonly float[] widths = { 2f, 4f, 7f, 11f };
    int widthIndex = 0;
    Color inkColor = Color.FromArgb(0, 120, 255);
    ToolMode toolMode = ToolMode.Pen;
    PointerMode pointerMode = PointerMode.Off;
    Rectangle selectedScreen = Rectangle.Empty;
    Rectangle oldPointerRect = Rectangle.Empty;
    string selectedEmoji = "🙂";

    bool expanded;
    bool allowExit;
    bool draggingWindow;
    Point dragStartMouse;
    Point dragStartWindow;

    public Color InkColor => inkColor;
    public float InkWidth => widths[widthIndex];
    public int WidthIndex => widthIndex;
    public ToolMode CurrentTool => toolMode;
    public PointerMode CurrentPointer => pointerMode;
    public string SelectedEmoji => selectedEmoji;
    public Rectangle CaptureSelection => selectedScreen;

    public MainForm(bool startMinimized)
    {
        Text = "PELEGO Marcador de Tela 3.2";
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = true;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        BackColor = Color.FromArgb(242, 242, 242);
        KeyPreview = true;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        ClientSize = new Size(LauncherWidth, LauncherHeight);
        LoadLocation();
        canvas = new CanvasForm(this);
        BuildLauncher();

        pointerTimer = new System.Windows.Forms.Timer { Interval = 16 };
        pointerTimer.Tick += (_, _) => UpdatePointerOverlay();
        pointerTimer.Start();

        FormClosing += (_, e) =>
        {
            if (allowExit) return;
            e.Cancel = true;
            ExitApp();
        };
        Move += (_, _) => SaveLocation();
        Shown += (_, _) =>
        {
            RegisterHotkeys();
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

    // Sombra discreta atrás da paleta e do launcher.
    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ClassStyle |= 0x00020000; // CS_DROPSHADOW
            return cp;
        }
    }

    void BuildLauncher()
    {
        expanded = false;
        Controls.Clear();
        ClientSize = new Size(LauncherWidth, LauncherHeight);
        Controls.Add(CreateHeader());

        var start = new Button
        {
            Text = "Start",
            Left = 3,
            Top = 26,
            Width = 56,
            Height = 31,
            FlatStyle = FlatStyle.System,
            TabStop = false
        };
        start.Click += (_, _) => ExpandPalette();
        Controls.Add(start);
        tips.SetToolTip(start, "Abrir a paleta neste local");
    }

    void ExpandPalette()
    {
        var here = Location;
        expanded = true;
        Controls.Clear();
        toolButtons.Clear();
        pointerButtons.Clear();
        colorButtons.Clear();
        thicknessButtons.Clear();

        ClientSize = new Size(PaletteWidth, PaletteHeight);
        Location = ClampLocation(here, ClientSize);
        Controls.Add(CreateHeader());

        // 5 sessões e nada além delas: espessura, cor, ferramentas, mouse, ações.
        int y = 27;

        // 1) ESPESSURA: 4 níveis fixos, mandando em todas as ferramentas.
        AddThicknessPair(ref y, 0, 1);
        AddThicknessPair(ref y, 2, 3);
        SectionGap(ref y);

        // 2) COR: 10 cores em 2 colunas x 5 linhas.
        AddColorPair(ref y, Color.FromArgb(255, 40, 40), Color.FromArgb(255, 130, 20));
        AddColorPair(ref y, Color.Yellow, Color.LimeGreen);
        AddColorPair(ref y, Color.DeepSkyBlue, Color.FromArgb(0, 60, 220));
        AddColorPair(ref y, Color.FromArgb(90, 70, 210), Color.DeepPink);
        AddColorPair(ref y, Color.White, Color.Black);
        SectionGap(ref y);

        // 3) FERRAMENTAS: exatamente o conjunto aprovado, mais Emoji no espaço extra.
        AddToolPair(ref y, ToolMode.Pen, GlyphKind.Pen, "Mão livre", ToolMode.Eraser, GlyphKind.Eraser, "Borracha");
        AddToolPair(ref y, ToolMode.Line, GlyphKind.Line, "Linha", ToolMode.Arrow, GlyphKind.Arrow, "Seta");
        AddToolPair(ref y, ToolMode.DoubleArrow, GlyphKind.DoubleArrow, "Seta dupla", ToolMode.RectOutline, GlyphKind.RectOutline, "Retângulo vazio");
        AddToolPair(ref y, ToolMode.RectFill, GlyphKind.RectFill, "Retângulo preenchido", ToolMode.EllipseOutline, GlyphKind.EllipseOutline, "Elipse vazia");
        AddToolPair(ref y, ToolMode.EllipseFill, GlyphKind.EllipseFill, "Elipse preenchida", ToolMode.Select, GlyphKind.Select, "Selecionar área da captura");
        AddToolPair(ref y, ToolMode.Text, GlyphKind.Text, "Texto", ToolMode.Emoji, GlyphKind.Emoji, "Emoji");
        SectionGap(ref y);

        // 4) FORMATO DO MOUSE: 2 em cima, 2 embaixo. Clicar no selecionado desliga o efeito.
        AddPointerPair(ref y, PointerMode.Ring, GlyphKind.Ring, "Círculo", PointerMode.Target, GlyphKind.Target, "Mira");
        AddPointerPair(ref y, PointerMode.Hand, GlyphKind.Hand, "Mão", PointerMode.Pen, GlyphKind.PointerPen, "Caneta");
        SectionGap(ref y);

        // 5) AÇÕES: desfazer, limpar, novo, copiar, imprimir, salvar.
        AddActionPair(ref y,
            MakeAction(GlyphKind.Undo, "Desfazer uma ação", canvas.Undo),
            MakeAction(GlyphKind.Trash, "Limpar desenhos", ClearDrawings));
        AddActionPair(ref y,
            MakeAction(GlyphKind.New, "Novo", NewCanvas),
            MakeAction(GlyphKind.Copy, "Copiar (Ctrl+C)", CopyCapture));
        AddActionPair(ref y,
            MakeAction(GlyphKind.Print, "Imprimir", PrintCapture),
            MakeAction(GlyphKind.Save, "Salvar PNG, JPG ou PDF", SaveCapture));

        toolMode = ToolMode.Pen;
        pointerMode = PointerMode.Off;
        widthIndex = Math.Clamp(widthIndex, 0, 3);
        UpdateSelections();

        if (!canvas.Visible) canvas.Show();
        canvas.SetMode(toolMode);
        canvas.SetInteractive(true);
        canvas.Invalidate();
        BringToFront();
        Activate();
    }

    Panel CreateHeader()
    {
        var p = new Panel
        {
            Left = 0,
            Top = 0,
            Width = ClientSize.Width,
            Height = 22,
            BackColor = Color.FromArgb(242, 242, 242)
        };

        var iconBox = new PictureBox
        {
            Left = 3,
            Top = 2,
            Width = 18,
            Height = 18,
            SizeMode = PictureBoxSizeMode.StretchImage,
            BackColor = Color.Transparent
        };
        try
        {
            var ico = Icon ?? Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            if (ico != null) iconBox.Image = ico.ToBitmap();
        }
        catch { }

        var close = new Button
        {
            Text = "×",
            Left = ClientSize.Width - 22,
            Top = 1,
            Width = 20,
            Height = 19,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(205, 65, 65),
            ForeColor = Color.White,
            TabStop = false,
            Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 8f, FontStyle.Bold)
        };
        close.FlatAppearance.BorderSize = 0;
        close.Click += (_, _) => ExitApp();

        AttachDrag(p);
        AttachDrag(iconBox);
        p.Controls.Add(iconBox);
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

    void AddThicknessPair(ref int y, int leftIndex, int rightIndex)
    {
        var a = MakeThickness(leftIndex);
        var b = MakeThickness(rightIndex);
        PlacePair(a, b, y);
        y += 29;
    }

    ThicknessButton MakeThickness(int index)
    {
        var b = new ThicknessButton(widths[index]);
        b.Click += (_, _) =>
        {
            widthIndex = index;
            UpdateSelections();
        };
        thicknessButtons.Add(b);
        tips.SetToolTip(b, $"Espessura {index + 1}");
        return b;
    }

    void AddColorPair(ref int y, Color aColor, Color bColor)
    {
        var a = MakeColor(aColor);
        var b = MakeColor(bColor);
        PlacePair(a, b, y);
        y += 29;
    }

    ColorButton MakeColor(Color c)
    {
        var b = new ColorButton(c);
        b.Click += (_, _) =>
        {
            inkColor = c;
            UpdateSelections();
        };
        colorButtons.Add(b);
        tips.SetToolTip(b, $"Cor {c.Name}");
        return b;
    }

    void AddToolPair(ref int y, ToolMode aMode, GlyphKind aGlyph, string aTip, ToolMode bMode, GlyphKind bGlyph, string bTip)
    {
        var a = MakeTool(aMode, aGlyph, aTip);
        var b = MakeTool(bMode, bGlyph, bTip);
        PlacePair(a, b, y);
        y += 29;
    }

    GlyphButton MakeTool(ToolMode mode, GlyphKind glyph, string tip)
    {
        var b = new GlyphButton(glyph);
        b.Click += (_, _) => SetTool(mode);
        toolButtons[mode] = b;
        tips.SetToolTip(b, tip);
        return b;
    }

    void AddPointerPair(ref int y, PointerMode aMode, GlyphKind aGlyph, string aTip, PointerMode bMode, GlyphKind bGlyph, string bTip)
    {
        var a = MakePointer(aMode, aGlyph, aTip);
        var b = MakePointer(bMode, bGlyph, bTip);
        PlacePair(a, b, y);
        y += 29;
    }

    GlyphButton MakePointer(PointerMode mode, GlyphKind glyph, string tip)
    {
        var b = new GlyphButton(glyph);
        b.Click += (_, _) =>
        {
            pointerMode = pointerMode == mode ? PointerMode.Off : mode;
            UpdateSelections();
            oldPointerRect = Rectangle.Empty;
            canvas.Invalidate();
        };
        pointerButtons[mode] = b;
        tips.SetToolTip(b, tip);
        return b;
    }

    void AddActionPair(ref int y, Control a, Control b)
    {
        PlacePair(a, b, y);
        y += 29;
    }

    GlyphButton MakeAction(GlyphKind glyph, string tip, Action action)
    {
        var b = new GlyphButton(glyph);
        b.Click += (_, _) => action();
        tips.SetToolTip(b, tip);
        return b;
    }

    void PlacePair(Control a, Control b, int y)
    {
        a.SetBounds(5, y, 24, 24);
        b.SetBounds(33, y, 24, 24);
        Controls.Add(a);
        Controls.Add(b);
    }

    void SectionGap(ref int y)
    {
        Controls.Add(new Panel
        {
            Left = 5,
            Top = y + 2,
            Width = 52,
            Height = 1,
            BackColor = Color.FromArgb(175, 175, 175)
        });
        y += 12;
    }

    void SetTool(ToolMode mode)
    {
        if (!expanded) return;

        if (mode == ToolMode.Emoji)
        {
            canvas.SetInteractive(false);
            using var picker = new EmojiPickerForm(selectedEmoji);
            picker.StartPosition = FormStartPosition.Manual;
            picker.Location = new Point(Right + 6, Math.Max(0, Top + 250));
            if (picker.ShowDialog(this) == DialogResult.OK && !string.IsNullOrWhiteSpace(picker.SelectedEmoji))
                selectedEmoji = picker.SelectedEmoji;
        }

        toolMode = mode;
        canvas.SetMode(mode);
        canvas.SetInteractive(mode != ToolMode.Mouse);
        UpdateSelections();
        BringToFront();
    }

    void UpdateSelections()
    {
        foreach (var kv in toolButtons) kv.Value.Selected = kv.Key == toolMode;
        foreach (var kv in pointerButtons) kv.Value.Selected = kv.Key == pointerMode;
        for (int i = 0; i < thicknessButtons.Count; i++) thicknessButtons[i].Selected = i == widthIndex;
        foreach (var b in colorButtons) b.Selected = b.Value.ToArgb() == inkColor.ToArgb();
    }

    public bool IsToolbarPoint(Point p) => Visible && WindowState == FormWindowState.Normal && Bounds.Contains(p);

    public void ReleaseDrawingOnly()
    {
        toolMode = ToolMode.Mouse;
        canvas.SetMode(ToolMode.Mouse);
        canvas.SetInteractive(false);
        UpdateSelections();
        BringToFront();
    }

    public void SetCaptureSelection(Rectangle screenRect)
    {
        selectedScreen = screenRect;
        canvas.SetSelection(screenRect);
    }

    public void AddTextAt(Point canvasPoint)
    {
        using var dlg = new TextEntryForm(inkColor);
        var screen = canvas.PointToScreen(canvasPoint);
        dlg.StartPosition = FormStartPosition.Manual;
        dlg.Location = new Point(screen.X + 12, screen.Y + 12);
        if (dlg.ShowDialog(this) == DialogResult.OK && !string.IsNullOrWhiteSpace(dlg.Value))
        {
            var sizes = new[] { 16f, 22f, 30f, 40f };
            canvas.AddText(canvasPoint, dlg.Value.Trim(), inkColor, sizes[widthIndex]);
        }
    }

    public void AddEmojiAt(Point canvasPoint)
    {
        var sizes = new[] { 22f, 30f, 42f, 56f };
        canvas.AddText(canvasPoint, selectedEmoji, inkColor, sizes[widthIndex], emoji: true);
    }

    void ClearDrawings() => canvas.ClearAll();

    void NewCanvas()
    {
        canvas.ClearAll();
        selectedScreen = Rectangle.Empty;
        canvas.SetSelection(Rectangle.Empty);
        toolMode = ToolMode.Pen;
        canvas.SetMode(toolMode);
        canvas.SetInteractive(true);
        UpdateSelections();
    }

    Rectangle GetCaptureBounds()
    {
        if (!selectedScreen.IsEmpty && selectedScreen.Width > 1 && selectedScreen.Height > 1)
            return selectedScreen;
        return Screen.FromPoint(Cursor.Position).Bounds;
    }

    Bitmap CaptureCurrent()
    {
        var rect = GetCaptureBounds();
        var wasVisible = Visible;
        canvas.SuppressDecorations = true;
        canvas.Invalidate();
        if (wasVisible) Hide();
        Application.DoEvents();
        System.Threading.Thread.Sleep(70);

        var bmp = new Bitmap(rect.Width, rect.Height, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
            g.CopyFromScreen(rect.Left, rect.Top, 0, 0, rect.Size, CopyPixelOperation.SourceCopy);

        if (wasVisible)
        {
            Show();
            BringToFront();
        }
        canvas.SuppressDecorations = false;
        canvas.Invalidate();
        return bmp;
    }

    void CopyCapture()
    {
        try
        {
            using var bmp = CaptureCurrent();
            Clipboard.SetImage(new Bitmap(bmp));
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Não foi possível copiar a captura.\n" + ex.Message, "PELEGO", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    void SaveCapture()
    {
        var restoreInteractive = toolMode != ToolMode.Mouse;
        canvas.SetInteractive(false);
        try
        {
        using var format = new SaveFormatDialog();
        if (format.ShowDialog(this) != DialogResult.OK) return;

        var ext = format.SelectedFormat switch
        {
            SaveKind.Png => "png",
            SaveKind.Jpg => "jpg",
            _ => "pdf"
        };

        using var dlg = new SaveFileDialog
        {
            Title = "Salvar captura",
            DefaultExt = ext,
            AddExtension = true,
            Filter = format.SelectedFormat switch
            {
                SaveKind.Png => "PNG (*.png)|*.png",
                SaveKind.Jpg => "JPG (*.jpg)|*.jpg",
                _ => "PDF (*.pdf)|*.pdf"
            },
            FileName = $"PELEGO-{DateTime.Now:yyyyMMdd-HHmmss}.{ext}"
        };
        if (dlg.ShowDialog(this) != DialogResult.OK) return;

        try
        {
            using var bmp = CaptureCurrent();
            if (format.SelectedFormat == SaveKind.Png)
                bmp.Save(dlg.FileName, ImageFormat.Png);
            else if (format.SelectedFormat == SaveKind.Jpg)
                SaveJpeg(bmp, dlg.FileName, 92L);
            else
                PdfSaver.SaveBitmapAsPdf(bmp, dlg.FileName);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Não foi possível salvar.\n" + ex.Message, "PELEGO", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        }
        finally
        {
            if (restoreInteractive && toolMode != ToolMode.Mouse) canvas.SetInteractive(true);
        }
    }

    static void SaveJpeg(Bitmap bmp, string path, long quality)
    {
        var codec = ImageCodecInfo.GetImageEncoders().FirstOrDefault(c => c.FormatID == ImageFormat.Jpeg.Guid);
        if (codec == null) { bmp.Save(path, ImageFormat.Jpeg); return; }
        using var ep = new EncoderParameters(1);
        ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
        bmp.Save(path, codec, ep);
    }

    void PrintCapture()
    {
        var restoreInteractive = toolMode != ToolMode.Mouse;
        canvas.SetInteractive(false);
        Bitmap? bmp = null;
        try
        {
            bmp = CaptureCurrent();
            using var doc = new PrintDocument { DocumentName = "PELEGO Captura" };
            doc.PrintPage += (_, e) =>
            {
                if (e.Graphics == null || bmp == null) return;
                var area = e.MarginBounds;
                var scale = Math.Min(area.Width / (float)bmp.Width, area.Height / (float)bmp.Height);
                var w = (int)(bmp.Width * scale);
                var h = (int)(bmp.Height * scale);
                var x = area.Left + (area.Width - w) / 2;
                var y = area.Top + (area.Height - h) / 2;
                e.Graphics.DrawImage(bmp, new Rectangle(x, y, w, h));
            };
            using var pd = new PrintDialog { Document = doc, UseEXDialog = true };
            if (pd.ShowDialog(this) == DialogResult.OK) doc.Print();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, "Não foi possível imprimir.\n" + ex.Message, "PELEGO", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        finally
        {
            bmp?.Dispose();
            if (restoreInteractive && toolMode != ToolMode.Mouse) canvas.SetInteractive(true);
        }
    }

    void UpdatePointerOverlay()
    {
        if (!expanded || !canvas.Visible) return;
        var next = canvas.GetPointerScreenBounds(Cursor.Position);
        Rectangle dirty;
        if (oldPointerRect.IsEmpty) dirty = next;
        else if (next.IsEmpty) dirty = oldPointerRect;
        else dirty = Rectangle.Union(oldPointerRect, next);
        oldPointerRect = next;
        if (!dirty.IsEmpty) canvas.InvalidateScreenRect(dirty);
    }

    void RegisterHotkeys()
    {
        if (!IsHandleCreated) return;
        Native.UnregisterHotKey(Handle, HOTKEY_PANIC);
        Native.UnregisterHotKey(Handle, HOTKEY_COPY);
        Native.RegisterHotKey(Handle, HOTKEY_PANIC, Native.MOD_CONTROL | Native.MOD_ALT, (uint)Keys.F12);
        Native.RegisterHotKey(Handle, HOTKEY_COPY, Native.MOD_CONTROL, (uint)Keys.C);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == Native.WM_HOTKEY)
        {
            if (m.WParam.ToInt32() == HOTKEY_PANIC)
            {
                ReleaseDrawingOnly();
                pointerMode = PointerMode.Off;
                UpdateSelections();
                canvas.Invalidate();
                return;
            }
            if (m.WParam.ToInt32() == HOTKEY_COPY)
            {
                CopyCapture();
                return;
            }
        }
        base.WndProc(ref m);
    }

    void ExitApp()
    {
        allowExit = true;
        pointerTimer.Stop();
        try { canvas.SetInteractive(false); canvas.Close(); } catch { }
        if (IsHandleCreated)
        {
            Native.UnregisterHotKey(Handle, HOTKEY_PANIC);
            Native.UnregisterHotKey(Handle, HOTKEY_COPY);
        }
        Application.Exit();
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
        return new Point(
            Math.Clamp(p.X, wa.Left, Math.Max(wa.Left, wa.Right - s.Width)),
            Math.Clamp(p.Y, wa.Top, Math.Max(wa.Top, wa.Bottom - s.Height)));
    }
}

sealed class ThicknessButton : Button
{
    public float Weight { get; }
    bool selected;
    public bool Selected { get => selected; set { selected = value; Invalidate(); } }

    public ThicknessButton(float weight)
    {
        Weight = weight;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        BackColor = Color.FromArgb(246, 246, 246);
        TabStop = false;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        e.Graphics.Clear(Selected ? Color.FromArgb(215, 235, 255) : BackColor);
        using var border = new Pen(Selected ? Color.FromArgb(0, 110, 235) : Color.FromArgb(190, 190, 190), Selected ? 2f : 1f);
        e.Graphics.DrawRectangle(border, 0, 0, Width - 1, Height - 1);
        using var p = new Pen(Color.FromArgb(35, 35, 35), Math.Min(Weight, 9f)) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        e.Graphics.DrawLine(p, 5, Height / 2f, Width - 5, Height / 2f);
    }
}

sealed class ColorButton : Button
{
    public Color Value { get; }
    bool selected;
    public bool Selected { get => selected; set { selected = value; Invalidate(); } }

    public ColorButton(Color value)
    {
        Value = value;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        BackColor = Color.FromArgb(246, 246, 246);
        TabStop = false;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.Clear(BackColor);
        using var fill = new SolidBrush(Value);
        e.Graphics.FillRectangle(fill, 4, 4, Width - 8, Height - 8);
        using var edge = new Pen(Value == Color.White ? Color.Gray : Color.FromArgb(150, 150, 150), 1f);
        e.Graphics.DrawRectangle(edge, 4, 4, Width - 9, Height - 9);
        if (Selected)
        {
            using var sel = new Pen(Color.FromArgb(0, 110, 235), 2f);
            e.Graphics.DrawRectangle(sel, 1, 1, Width - 3, Height - 3);
        }
    }
}

sealed class GlyphButton : Button
{
    public GlyphKind Glyph { get; }
    bool selected;
    public bool Selected { get => selected; set { selected = value; Invalidate(); } }

    public GlyphButton(GlyphKind glyph)
    {
        Glyph = glyph;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
        BackColor = Color.FromArgb(246, 246, 246);
        TabStop = false;
        Margin = Padding.Empty;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.Clear(Selected ? Color.FromArgb(215, 235, 255) : BackColor);
        using (var border = new Pen(Selected ? Color.FromArgb(0, 110, 235) : Color.FromArgb(190, 190, 190), Selected ? 2f : 1f))
            g.DrawRectangle(border, 0, 0, Width - 1, Height - 1);
        DrawGlyph(g, new Rectangle(4, 4, Width - 8, Height - 8), Glyph);
    }

    static void DrawGlyph(Graphics g, Rectangle r, GlyphKind k)
    {
        var c = Color.FromArgb(30, 30, 45);
        using var p = new Pen(c, 1.6f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round };
        using var thin = new Pen(c, 1f);
        using var fill = new SolidBrush(c);
        var cx = r.Left + r.Width / 2f;
        var cy = r.Top + r.Height / 2f;

        switch (k)
        {
            case GlyphKind.Pen:
                g.DrawBezier(p, r.Left + 1, cy, r.Left + 4, r.Top, r.Right - 4, r.Bottom, r.Right - 1, cy);
                break;
            case GlyphKind.Eraser:
                g.DrawPolygon(p, new[] { new PointF(r.Left + 2, r.Bottom - 4), new PointF(r.Left + 7, r.Top + 2), new PointF(r.Right - 2, r.Top + 7), new PointF(r.Right - 7, r.Bottom - 1) });
                break;
            case GlyphKind.Line:
                g.DrawLine(p, r.Left + 1, r.Bottom - 2, r.Right - 1, r.Top + 2);
                break;
            case GlyphKind.Arrow:
                DrawArrow(g, p, new PointF(r.Left + 1, r.Bottom - 2), new PointF(r.Right - 2, r.Top + 2), false);
                break;
            case GlyphKind.DoubleArrow:
                DrawArrow(g, p, new PointF(r.Left + 1, cy), new PointF(r.Right - 1, cy), true);
                break;
            case GlyphKind.RectOutline:
                g.DrawRectangle(thin, r.Left + 1, r.Top + 3, r.Width - 3, r.Height - 6);
                break;
            case GlyphKind.RectFill:
                g.FillRectangle(new SolidBrush(Color.FromArgb(145, 145, 145)), r.Left + 1, r.Top + 3, r.Width - 3, r.Height - 6);
                break;
            case GlyphKind.EllipseOutline:
                g.DrawEllipse(thin, r.Left + 1, r.Top + 3, r.Width - 3, r.Height - 6);
                break;
            case GlyphKind.EllipseFill:
                g.FillEllipse(new SolidBrush(Color.FromArgb(145, 145, 145)), r.Left + 1, r.Top + 3, r.Width - 3, r.Height - 6);
                break;
            case GlyphKind.Select:
                using (var dash = new Pen(c, 1f) { DashStyle = DashStyle.Dash }) g.DrawRectangle(dash, r.Left + 1, r.Top + 1, r.Width - 3, r.Height - 3);
                break;
            case GlyphKind.Text:
                using (var font = new Font(SystemFonts.MessageBoxFont.FontFamily, 12f, FontStyle.Regular, GraphicsUnit.Pixel)) g.DrawString("A", font, fill, r.Left + 2, r.Top - 1);
                break;
            case GlyphKind.Emoji:
                using (var font = new Font("Segoe UI Emoji", 11f, FontStyle.Regular, GraphicsUnit.Pixel)) g.DrawString("🙂", font, Brushes.Goldenrod, r.Left, r.Top);
                break;
            case GlyphKind.Ring:
                g.DrawEllipse(p, r.Left + 1, r.Top + 1, r.Width - 2, r.Height - 2);
                break;
            case GlyphKind.Target:
                g.DrawEllipse(thin, r.Left + 3, r.Top + 3, r.Width - 6, r.Height - 6);
                g.DrawLine(thin, cx, r.Top, cx, r.Bottom);
                g.DrawLine(thin, r.Left, cy, r.Right, cy);
                break;
            case GlyphKind.Hand:
                try { Cursors.Hand.Draw(g, new Rectangle(r.Left - 1, r.Top - 1, r.Width + 5, r.Height + 5)); } catch { g.DrawEllipse(p, r); }
                break;
            case GlyphKind.PointerPen:
                g.DrawLine(p, r.Left + 2, r.Bottom - 2, r.Right - 3, r.Top + 3);
                g.DrawLine(p, r.Right - 5, r.Top + 2, r.Right - 1, r.Top + 6);
                break;
            case GlyphKind.Undo:
                g.DrawArc(p, r.Left + 3, r.Top + 3, r.Width - 4, r.Height - 5, 200, 250);
                g.DrawLine(p, r.Left + 2, cy, r.Left + 7, cy - 4);
                break;
            case GlyphKind.Trash:
                g.DrawRectangle(thin, r.Left + 5, r.Top + 5, r.Width - 9, r.Height - 6);
                g.DrawLine(p, r.Left + 4, r.Top + 4, r.Right - 3, r.Top + 4);
                g.DrawLine(p, r.Left + 7, r.Top + 1, r.Right - 6, r.Top + 1);
                break;
            case GlyphKind.New:
                g.DrawRectangle(thin, r.Left + 3, r.Top + 1, r.Width - 7, r.Height - 2);
                break;
            case GlyphKind.Copy:
                g.DrawRectangle(thin, r.Left + 1, r.Top + 1, r.Width - 7, r.Height - 7);
                g.DrawRectangle(p, r.Left + 5, r.Top + 5, r.Width - 7, r.Height - 7);
                break;
            case GlyphKind.Print:
                g.DrawRectangle(thin, r.Left + 3, r.Top + 1, r.Width - 6, 5);
                g.DrawRectangle(p, r.Left + 1, r.Top + 6, r.Width - 2, 7);
                g.DrawRectangle(thin, r.Left + 4, r.Top + 10, r.Width - 8, r.Height - 11);
                break;
            case GlyphKind.Save:
                g.DrawRectangle(p, r.Left + 1, r.Top + 1, r.Width - 2, r.Height - 2);
                g.DrawRectangle(thin, r.Left + 4, r.Top + 2, r.Width - 8, 5);
                g.DrawRectangle(thin, r.Left + 4, r.Bottom - 7, r.Width - 8, 6);
                break;
        }
    }

    static void DrawArrow(Graphics g, Pen p, PointF a, PointF b, bool both)
    {
        g.DrawLine(p, a, b);
        DrawHead(g, p, a, b);
        if (both) DrawHead(g, p, b, a);
    }

    static void DrawHead(Graphics g, Pen p, PointF from, PointF to)
    {
        var dx = to.X - from.X;
        var dy = to.Y - from.Y;
        var len = Math.Max(1f, (float)Math.Sqrt(dx * dx + dy * dy));
        dx /= len; dy /= len;
        var px = -dy; var py = dx;
        var size = 5f;
        var baseX = to.X - dx * size;
        var baseY = to.Y - dy * size;
        g.DrawLine(p, to, new PointF(baseX + px * 3, baseY + py * 3));
        g.DrawLine(p, to, new PointF(baseX - px * 3, baseY - py * 3));
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
    bool textDialogPending;
    Rectangle selectionLocal = Rectangle.Empty;

    public bool SuppressDecorations { get; set; }

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

    public void SetSelection(Rectangle screenRect)
    {
        if (screenRect.IsEmpty) selectionLocal = Rectangle.Empty;
        else selectionLocal = new Rectangle(screenRect.Left - Left, screenRect.Top - Top, screenRect.Width, screenRect.Height);
        Invalidate();
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
            if (mode == ToolMode.Text)
            {
                RequestText(p);
                return (IntPtr)1;
            }
            if (mode == ToolMode.Emoji)
            {
                try { BeginInvoke(new Action(() => owner.AddEmojiAt(p))); } catch { }
                return (IntPtr)1;
            }
            HandleDown(p);
            return (IntPtr)1;
        }

        if (msg == Native.WM_MOUSEMOVE && dragging)
        {
            HandleMove(p);
            // Fundamental para vídeo: o movimento do mouse continua no Windows.
            return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);
        }

        if (msg == Native.WM_LBUTTONUP && dragging)
        {
            HandleUp(p);
            return (IntPtr)1;
        }

        return Native.CallNextHookEx(mouseHook, nCode, wParam, lParam);
    }

    void RequestText(Point p)
    {
        if (textDialogPending) return;
        textDialogPending = true;
        try
        {
            BeginInvoke(new Action(() =>
            {
                SetInteractive(false);
                try { owner.AddTextAt(p); }
                finally
                {
                    textDialogPending = false;
                    if (owner.CurrentTool == ToolMode.Text && Visible)
                        SetInteractive(true);
                }
            }));
        }
        catch { textDialogPending = false; }
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
            case ToolMode.Eraser:
                EraseAt(p);
                break;
            case ToolMode.Line:
                current = new LineShape(owner.InkColor, owner.InkWidth, p, p, ArrowEnds.None);
                break;
            case ToolMode.Arrow:
                current = new LineShape(owner.InkColor, owner.InkWidth, p, p, ArrowEnds.End);
                break;
            case ToolMode.DoubleArrow:
                current = new LineShape(owner.InkColor, owner.InkWidth, p, p, ArrowEnds.Both);
                break;
            case ToolMode.RectOutline:
                current = new RectShape(owner.InkColor, owner.InkWidth, RectFrom(p, p), ellipse: false, filled: false);
                break;
            case ToolMode.RectFill:
                current = new RectShape(owner.InkColor, owner.InkWidth, RectFrom(p, p), ellipse: false, filled: true);
                break;
            case ToolMode.EllipseOutline:
                current = new RectShape(owner.InkColor, owner.InkWidth, RectFrom(p, p), ellipse: true, filled: false);
                break;
            case ToolMode.EllipseFill:
                current = new RectShape(owner.InkColor, owner.InkWidth, RectFrom(p, p), ellipse: true, filled: true);
                break;
            case ToolMode.Select:
                selectionLocal = Rectangle.Empty;
                break;
            default:
                dragging = false;
                break;
        }
    }

    void HandleMove(Point p)
    {
        if (!dragging) return;
        var before = current?.Bounds ?? Rectangle.Empty;

        switch (mode)
        {
            case ToolMode.Pen:
                if (current is StrokeShape s) s.Add(p);
                break;
            case ToolMode.Eraser:
                EraseAt(p);
                break;
            case ToolMode.Line:
            case ToolMode.Arrow:
            case ToolMode.DoubleArrow:
                if (current is LineShape l) l.B = p;
                break;
            case ToolMode.RectOutline:
            case ToolMode.RectFill:
            case ToolMode.EllipseOutline:
            case ToolMode.EllipseFill:
                if (current is RectShape r) r.Rect = RectFrom(start, p);
                break;
            case ToolMode.Select:
                selectionLocal = RectFrom(start, p);
                Invalidate();
                last = p;
                return;
        }

        var after = current?.Bounds ?? Rectangle.Empty;
        var dirty = Rectangle.Union(before, after);
        dirty = Rectangle.Union(dirty, Rectangle.FromLTRB(Math.Min(last.X, p.X), Math.Min(last.Y, p.Y), Math.Max(last.X, p.X) + 1, Math.Max(last.Y, p.Y) + 1));
        dirty.Inflate(30, 30);
        Invalidate(dirty);
        last = p;
    }

    void HandleUp(Point p)
    {
        dragging = false;

        if (mode == ToolMode.Select)
        {
            selectionLocal = RectFrom(start, p);
            var sr = new Rectangle(selectionLocal.Left + Left, selectionLocal.Top + Top, selectionLocal.Width, selectionLocal.Height);
            owner.SetCaptureSelection(sr);
            Invalidate();
            return;
        }

        if (current != null && mode is ToolMode.Line or ToolMode.Arrow or ToolMode.DoubleArrow or ToolMode.RectOutline or ToolMode.RectFill or ToolMode.EllipseOutline or ToolMode.EllipseFill)
        {
            if (current.Bounds.Width > 1 || current.Bounds.Height > 1) shapes.Add(current);
        }
        current = null;
        Invalidate();
    }

    void EraseAt(Point p)
    {
        var tolerance = 5f + owner.InkWidth * 1.8f;
        for (int i = shapes.Count - 1; i >= 0; i--)
        {
            if (!shapes[i].Hit(p, tolerance)) continue;
            var b = shapes[i].Bounds;
            shapes.RemoveAt(i);
            b.Inflate(24, 24);
            Invalidate(b);
            return;
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
        Invalidate();
    }

    public void AddText(Point p, string text, Color color, float size, bool emoji = false)
    {
        shapes.Add(new TextShape(text, p, color, size, emoji));
        Invalidate();
    }

    public Rectangle GetPointerScreenBounds(Point cursor)
    {
        if (owner.CurrentPointer == PointerMode.Off || !Visible || SuppressDecorations) return Rectangle.Empty;
        var r = owner.CurrentPointer == PointerMode.Ring ? 34 : 38;
        return new Rectangle(cursor.X - r - 6, cursor.Y - r - 6, (r + 6) * 2, (r + 6) * 2);
    }

    public void InvalidateScreenRect(Rectangle screenRect)
    {
        if (screenRect.IsEmpty) return;
        Invalidate(new Rectangle(screenRect.Left - Left, screenRect.Top - Top, screenRect.Width, screenRect.Height));
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        foreach (var s in shapes) s.Draw(e.Graphics);
        if (current != null && !shapes.Contains(current)) current.Draw(e.Graphics);

        if (!SuppressDecorations && !selectionLocal.IsEmpty)
        {
            using var fill = new SolidBrush(Color.FromArgb(28, 0, 120, 255));
            using var pen = new Pen(Color.FromArgb(0, 100, 220), 1.5f) { DashStyle = DashStyle.Dash };
            e.Graphics.FillRectangle(fill, selectionLocal);
            e.Graphics.DrawRectangle(pen, selectionLocal);
        }

        if (!SuppressDecorations) DrawPointer(e.Graphics);
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
                g.DrawEllipse(pen, p.X - 24, p.Y - 24, 48, 48);
                break;
            case PointerMode.Target:
                g.DrawEllipse(pen, p.X - 18, p.Y - 18, 36, 36);
                g.DrawLine(pen, p.X - 31, p.Y, p.X - 6, p.Y);
                g.DrawLine(pen, p.X + 6, p.Y, p.X + 31, p.Y);
                g.DrawLine(pen, p.X, p.Y - 31, p.X, p.Y - 6);
                g.DrawLine(pen, p.X, p.Y + 6, p.X, p.Y + 31);
                break;
            case PointerMode.Hand:
                try { Cursors.Hand.Draw(g, new Rectangle(p.X - 5, p.Y - 4, 32, 32)); }
                catch { g.DrawEllipse(pen, p.X - 12, p.Y - 12, 24, 24); }
                break;
            case PointerMode.Pen:
                using (var body = new Pen(accent, 5f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                    g.DrawLine(body, p.X - 13, p.Y + 13, p.X + 11, p.Y - 11);
                break;
        }
    }

    static Rectangle RectFrom(Point a, Point b) => new(
        Math.Min(a.X, b.X), Math.Min(a.Y, b.Y),
        Math.Abs(a.X - b.X), Math.Abs(a.Y - b.Y));
}

enum ArrowEnds { None, End, Both }

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
    readonly ArrowEnds arrows;

    public LineShape(Color c, float w, Point a, Point b, ArrowEnds arrows) : base(c, w)
    {
        A = a; B = b; this.arrows = arrows;
    }

    public override Rectangle Bounds
    {
        get
        {
            var r = Rectangle.FromLTRB(Math.Min(A.X, B.X), Math.Min(A.Y, B.Y), Math.Max(A.X, B.X) + 1, Math.Max(A.Y, B.Y) + 1);
            r.Inflate(35, 35);
            return r;
        }
    }

    public override void Draw(Graphics g)
    {
        using var p = new Pen(Color, Width) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        if (arrows is ArrowEnds.End or ArrowEnds.Both)
            p.CustomEndCap = new AdjustableArrowCap(Math.Max(4, Width * 2.2f), Math.Max(5, Width * 2.7f), true);
        if (arrows == ArrowEnds.Both)
            p.CustomStartCap = new AdjustableArrowCap(Math.Max(4, Width * 2.2f), Math.Max(5, Width * 2.7f), true);
        g.DrawLine(p, A, B);
    }

    public override bool Hit(Point p, float t)
    {
        var s = new StrokeShape(Color, Width, A); s.Add(B); return s.Hit(p, t);
    }
}

sealed class RectShape : InkShape
{
    public Rectangle Rect { get; set; }
    readonly bool ellipse;
    readonly bool filled;

    public RectShape(Color c, float w, Rectangle r, bool ellipse, bool filled) : base(c, w)
    {
        Rect = r; this.ellipse = ellipse; this.filled = filled;
    }

    public override Rectangle Bounds
    {
        get
        {
            var r = Rect; r.Inflate((int)Width + 6, (int)Width + 6); return r;
        }
    }

    public override void Draw(Graphics g)
    {
        if (Rect.Width < 1 || Rect.Height < 1) return;
        if (filled)
        {
            using var b = new SolidBrush(Color);
            if (ellipse) g.FillEllipse(b, Rect); else g.FillRectangle(b, Rect);
        }
        using var p = new Pen(Color, Width);
        if (ellipse) g.DrawEllipse(p, Rect); else g.DrawRectangle(p, Rect);
    }

    public override bool Hit(Point p, float t)
    {
        if (filled) return Rect.Contains(p);
        var outer = Rect; outer.Inflate((int)(t + Width), (int)(t + Width));
        var inner = Rect; inner.Inflate(-(int)(t + Width), -(int)(t + Width));
        return outer.Contains(p) && (!inner.Contains(p) || inner.Width <= 0 || inner.Height <= 0);
    }
}

sealed class TextShape : InkShape
{
    readonly string text;
    readonly Point at;
    readonly float size;
    readonly bool emoji;
    readonly Rectangle cached;

    public TextShape(string text, Point at, Color c, float size, bool emoji) : base(c, 1)
    {
        this.text = text; this.at = at; this.size = size; this.emoji = emoji;
        cached = new Rectangle(at, new Size(Math.Max(24, text.Length * (int)(size * .8f)), (int)(size * 1.7f)));
    }

    public override Rectangle Bounds => cached;

    public override void Draw(Graphics g)
    {
        using var font = new Font(emoji ? "Segoe UI Emoji" : SystemFonts.MessageBoxFont.FontFamily.Name, size, FontStyle.Regular, GraphicsUnit.Pixel);
        using var brush = new SolidBrush(Color);
        g.DrawString(text, font, brush, at);
    }

    public override bool Hit(Point p, float t)
    {
        var r = cached; r.Inflate((int)t, (int)t); return r.Contains(p);
    }
}

sealed class TextEntryForm : Form
{
    readonly TextBox box;
    public string Value => box.Text;

    public TextEntryForm(Color color)
    {
        Text = "Texto";
        Width = 390;
        Height = 155;
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        TopMost = true;
        box = new TextBox
        {
            Left = 10, Top = 10, Width = 350, Height = 55, Multiline = true,
            Font = new Font(SystemFonts.MessageBoxFont.FontFamily, 12), ForeColor = color
        };
        var ok = new Button { Text = "Inserir", Left = 198, Top = 75, Width = 78, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancelar", Left = 282, Top = 75, Width = 78, DialogResult = DialogResult.Cancel };
        Controls.Add(box); Controls.Add(ok); Controls.Add(cancel);
        AcceptButton = ok; CancelButton = cancel;
        Shown += (_, _) => box.Focus();
    }
}

sealed class EmojiPickerForm : Form
{
    public string SelectedEmoji { get; private set; }

    public EmojiPickerForm(string current)
    {
        SelectedEmoji = current;
        Text = "Emoji";
        ClientSize = new Size(230, 92);
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        TopMost = true;
        ShowInTaskbar = false;
        var emojis = new[] { "🙂", "⭐", "👍", "❤️", "⚠️", "🔊", "🎯", "✅" };
        for (int i = 0; i < emojis.Length; i++)
        {
            var em = emojis[i];
            var b = new Button
            {
                Text = em,
                Left = 6 + (i % 4) * 55,
                Top = 6 + (i / 4) * 40,
                Width = 50,
                Height = 36,
                Font = new Font("Segoe UI Emoji", 15f, GraphicsUnit.Pixel)
            };
            b.Click += (_, _) => { SelectedEmoji = em; DialogResult = DialogResult.OK; Close(); };
            Controls.Add(b);
        }
    }
}

enum SaveKind { Png, Jpg, Pdf }

sealed class SaveFormatDialog : Form
{
    public SaveKind SelectedFormat { get; private set; } = SaveKind.Png;

    public SaveFormatDialog()
    {
        Text = "Salvar como";
        ClientSize = new Size(270, 72);
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        TopMost = true;
        ShowInTaskbar = false;
        Add("PNG", SaveKind.Png, 8);
        Add("JPG", SaveKind.Jpg, 94);
        Add("PDF", SaveKind.Pdf, 180);
    }

    void Add(string text, SaveKind kind, int left)
    {
        var b = new Button { Text = text, Left = left, Top = 16, Width = 78, Height = 34 };
        b.Click += (_, _) => { SelectedFormat = kind; DialogResult = DialogResult.OK; Close(); };
        Controls.Add(b);
    }
}

static class PdfSaver
{
    public static void SaveBitmapAsPdf(Bitmap bmp, string path)
    {
        using var jpeg = new MemoryStream();
        var codec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
        using (var ep = new EncoderParameters(1))
        {
            ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 92L);
            bmp.Save(jpeg, codec, ep);
        }
        var image = jpeg.ToArray();

        const float pageW = 595f;
        const float pageH = 842f;
        const float margin = 20f;
        var scale = Math.Min((pageW - 2 * margin) / bmp.Width, (pageH - 2 * margin) / bmp.Height);
        var w = bmp.Width * scale;
        var h = bmp.Height * scale;
        var x = (pageW - w) / 2f;
        var y = (pageH - h) / 2f;
        var content = Encoding.ASCII.GetBytes($"q\n{w:0.###} 0 0 {h:0.###} {x:0.###} {y:0.###} cm\n/Im0 Do\nQ\n");

        using var fs = new FileStream(path, FileMode.Create, FileAccess.Write);
        var offsets = new List<long> { 0 };
        WriteAscii(fs, "%PDF-1.4\n%PELEGO\n");
        Obj(fs, offsets, 1, "<< /Type /Catalog /Pages 2 0 R >>");
        Obj(fs, offsets, 2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
        Obj(fs, offsets, 3, $"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {pageW} {pageH}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>");

        offsets.Add(fs.Position);
        WriteAscii(fs, $"4 0 obj\n<< /Length {content.Length} >>\nstream\n");
        fs.Write(content, 0, content.Length);
        WriteAscii(fs, "endstream\nendobj\n");

        offsets.Add(fs.Position);
        WriteAscii(fs, $"5 0 obj\n<< /Type /XObject /Subtype /Image /Width {bmp.Width} /Height {bmp.Height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {image.Length} >>\nstream\n");
        fs.Write(image, 0, image.Length);
        WriteAscii(fs, "\nendstream\nendobj\n");

        var xref = fs.Position;
        WriteAscii(fs, "xref\n0 6\n0000000000 65535 f \n");
        for (int i = 1; i <= 5; i++) WriteAscii(fs, $"{offsets[i]:0000000000} 00000 n \n");
        WriteAscii(fs, $"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
    }

    static void Obj(Stream s, List<long> offsets, int n, string body)
    {
        offsets.Add(s.Position);
        WriteAscii(s, $"{n} 0 obj\n{body}\nendobj\n");
    }

    static void WriteAscii(Stream s, string text)
    {
        var bytes = Encoding.ASCII.GetBytes(text);
        s.Write(bytes, 0, bytes.Length);
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
    public const uint MOD_CONTROL = 0x0002;
    public const uint MOD_ALT = 0x0001;
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
