using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Printing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace PelegoMarkerV33;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        using var mutex = new Mutex(true, "PELEGO_MARCADOR_DE_TELA_SINGLE", out var first);
        if (!first) return;
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new MainForm(args.Any(a => a.Equals("/startup", StringComparison.OrdinalIgnoreCase))));
    }
}

enum ToolMode { Pen, Eraser, Line, Arrow, DoubleArrow, Rectangle, FilledRectangle, Ellipse, FilledEllipse, Text, Emoji, Select }
enum PointerMode { None, Circle, Target, Hand, Pen }
enum EraserShape { Freehand, Rectangle, Circle }
enum GlyphKind { App, Width1, Width2, Width3, Width4, Pen, Eraser, Line, Arrow, DoubleArrow, Rect, FilledRect, Ellipse, FilledEllipse, Text, Emoji, Select, MouseCircle, Target, Hand, MousePen, Undo, Trash, New, Copy, Print, Save }

sealed class MainForm : Form
{
    const int LauncherWidth = 62, LauncherHeight = 61, PaletteWidth = 62, PaletteHeight = 655;
    const int HOTKEY_COPY = 4201;
    readonly ToolTip tips = new();
    readonly Dictionary<ToolMode, GlyphButton> toolButtons = new();
    readonly Dictionary<PointerMode, GlyphButton> pointerButtons = new();
    readonly List<GlyphButton> widthButtons = new();
    readonly List<GlyphButton> colorButtons = new();
    readonly CanvasForm canvas;
    readonly NotifyIcon tray;
    readonly Cursor penCursor;
    ToolMode tool = ToolMode.Pen;
    PointerMode pointer = PointerMode.None;
    EraserShape eraserShape = EraserShape.Freehand;
    Color inkColor = Color.Red;
    float inkWidth = 4;
    bool expanded, allowExit, draggingWindow;
    Point dragMouse, dragWindow;

    public ToolMode Tool => tool;
    public PointerMode Pointer => pointer;
    public EraserShape EraserShape => eraserShape;
    public Color InkColor => inkColor;
    public float InkWidth => inkWidth;

    public MainForm(bool startup)
    {
        Text = "PELEGO Marcador de Tela 3.3";
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = true;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        BackColor = Color.FromArgb(238, 238, 238);
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { Icon = SystemIcons.Application; }
        penCursor = CursorFactory.CreatePenCursor();
        canvas = new CanvasForm(this);
        tray = new NotifyIcon { Icon = Icon ?? SystemIcons.Application, Text = "PELEGO Marcador de Tela", Visible = true };
        var menu = new ContextMenuStrip();
        menu.Items.Add("Abrir", null, (_, _) => ShowLauncherFromTray());
        menu.Items.Add("Sair", null, (_, _) => ExitApp());
        tray.ContextMenuStrip = menu;
        tray.DoubleClick += (_, _) => ShowLauncherFromTray();
        BuildLauncher();
        Location = new Point(40, 80);

        Shown += (_, _) =>
        {
            if (startup)
            {
                ShowInTaskbar = false;
                Hide();
            }
        };
        FormClosing += (_, e) =>
        {
            if (allowExit) return;
            e.Cancel = true;
            ExitApp();
        };
    }

    protected override CreateParams CreateParams
    {
        get
        {
            const int CS_DROPSHADOW = 0x00020000;
            var cp = base.CreateParams;
            cp.ClassStyle |= CS_DROPSHADOW;
            return cp;
        }
    }

    void ShowLauncherFromTray()
    {
        if (!Visible) Show();
        ShowInTaskbar = true;
        WindowState = FormWindowState.Normal;
        TopMost = true;
        BringToFront();
        Activate();
    }

    void BuildLauncher()
    {
        expanded = false;
        Native.UnregisterHotKey(Handle, HOTKEY_COPY);
        Controls.Clear();
        ClientSize = new Size(LauncherWidth, LauncherHeight);
        Controls.Add(CreateHeader());
        var start = new Button { Text = "Start", Left = 3, Top = 28, Width = 56, Height = 29, FlatStyle = FlatStyle.System, TabStop = false };
        start.Click += (_, _) => ExpandPalette();
        Controls.Add(start);
        tips.SetToolTip(start, "Abrir ferramentas");
    }

    void ExpandPalette()
    {
        expanded = true;
        Controls.Clear(); toolButtons.Clear(); pointerButtons.Clear(); widthButtons.Clear(); colorButtons.Clear();
        ClientSize = new Size(PaletteWidth, PaletteHeight);
        Controls.Add(CreateHeader());
        int y = 25;

        AddWidthPair(ref y, 2, GlyphKind.Width1, 4, GlyphKind.Width2);
        AddWidthPair(ref y, 8, GlyphKind.Width3, 14, GlyphKind.Width4);
        Divider(ref y);

        AddColorPair(ref y, Color.White, Color.Red);
        AddColorPair(ref y, Color.Orange, Color.Yellow);
        AddColorPair(ref y, Color.Green, Color.Lime);
        AddColorPair(ref y, Color.Blue, Color.DeepSkyBlue);
        AddColorPair(ref y, Color.Black, Color.Magenta);
        Divider(ref y);

        AddToolPair(ref y, ToolMode.Pen, GlyphKind.Pen, "Mão livre", ToolMode.Eraser, GlyphKind.Eraser, "Borracha (botão direito: formato)");
        AddToolPair(ref y, ToolMode.Line, GlyphKind.Line, "Linha", ToolMode.Arrow, GlyphKind.Arrow, "Seta");
        AddToolPair(ref y, ToolMode.DoubleArrow, GlyphKind.DoubleArrow, "Seta dupla", ToolMode.Text, GlyphKind.Text, "Texto");
        AddToolPair(ref y, ToolMode.Rectangle, GlyphKind.Rect, "Retângulo", ToolMode.FilledRectangle, GlyphKind.FilledRect, "Retângulo preenchido");
        AddToolPair(ref y, ToolMode.Ellipse, GlyphKind.Ellipse, "Elipse", ToolMode.FilledEllipse, GlyphKind.FilledEllipse, "Elipse preenchida");
        AddToolSingleWithBlank(ref y, ToolMode.Emoji, GlyphKind.Emoji, "Emoji");
        Divider(ref y);

        AddPointerPair(ref y, PointerMode.Circle, GlyphKind.MouseCircle, "Círculo", PointerMode.Target, GlyphKind.Target, "Mira");
        AddPointerPair(ref y, PointerMode.Hand, GlyphKind.Hand, "Mão com estrelas", PointerMode.Pen, GlyphKind.MousePen, "Caneta no lugar do cursor");
        Divider(ref y);

        AddActionPair(ref y, MakeAction(GlyphKind.Undo, "Desfazer", canvas.Undo), MakeAction(GlyphKind.Trash, "Limpar tela", canvas.ClearDrawings));
        AddActionPair(ref y, MakeAction(GlyphKind.New, "Novo", canvas.NewCanvas), MakeAction(GlyphKind.Copy, "Copiar", CopyCapture));
        AddActionPair(ref y, MakeAction(GlyphKind.Print, "Imprimir", PrintCapture), MakeAction(GlyphKind.Save, "Salvar", SaveCapture));
        AddActionPair(ref y, MakeSelectButton(), new Panel());

        SetTool(ToolMode.Pen);
        Native.RegisterHotKey(Handle, HOTKEY_COPY, Native.MOD_CONTROL, (uint)Keys.C);
        if (!canvas.Visible) canvas.Show();
        canvas.Invalidate();
        BringToFront();
    }

    Panel CreateHeader()
    {
        var p = new Panel { Left = 0, Top = 0, Width = ClientSize.Width, Height = 22, BackColor = Color.FromArgb(238,238,238) };
        var icon = new PictureBox { Left = 3, Top = 2, Width = 17, Height = 17, SizeMode = PictureBoxSizeMode.StretchImage, Image = (Icon ?? SystemIcons.Application).ToBitmap() };
        var close = new Button { Text = "×", Left = ClientSize.Width - 21, Top = 1, Width = 19, Height = 19, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(205,70,70), ForeColor = Color.White, TabStop = false };
        close.FlatAppearance.BorderSize = 0; close.Click += (_, _) => ExitApp();
        AttachDrag(p); AttachDrag(icon); p.Controls.Add(icon); p.Controls.Add(close); return p;
    }

    void AttachDrag(Control c)
    {
        c.MouseDown += (_, e) => { if (e.Button == MouseButtons.Left) { draggingWindow = true; dragMouse = Cursor.Position; dragWindow = Location; } };
        c.MouseMove += (_, _) => { if (!draggingWindow || (Control.MouseButtons & MouseButtons.Left) == 0) return; var n = Cursor.Position; Location = new Point(dragWindow.X+n.X-dragMouse.X, dragWindow.Y+n.Y-dragMouse.Y); };
        c.MouseUp += (_, _) => draggingWindow = false;
    }

    void Divider(ref int y) { Controls.Add(new Panel { Left=4, Top=y+3, Width=54, Height=1, BackColor=Color.Silver }); y += 10; }
    void PlacePair(Control a, Control b, int y) { a.SetBounds(4,y,25,25); b.SetBounds(33,y,25,25); Controls.Add(a); Controls.Add(b); }

    void AddWidthPair(ref int y, float wa, GlyphKind ga, float wb, GlyphKind gb)
    {
        var a = new GlyphButton(ga); var b = new GlyphButton(gb);
        a.Click += (_,_) => SetWidth(wa,a); b.Click += (_,_) => SetWidth(wb,b);
        widthButtons.Add(a); widthButtons.Add(b); PlacePair(a,b,y); y += 27;
    }
    void SetWidth(float w, GlyphButton b) { inkWidth = w; foreach (var x in widthButtons) x.Selected = ReferenceEquals(x,b); }

    void AddColorPair(ref int y, Color ca, Color cb)
    {
        var a = new GlyphButton(GlyphKind.Rect) { Swatch=ca }; var b = new GlyphButton(GlyphKind.Rect) { Swatch=cb };
        a.Click += (_,_) => SetColor(ca,a); b.Click += (_,_) => SetColor(cb,b); colorButtons.Add(a); colorButtons.Add(b); PlacePair(a,b,y); y += 27;
    }
    void SetColor(Color c, GlyphButton b) { inkColor=c; foreach(var x in colorButtons) x.Selected=ReferenceEquals(x,b); }

    void AddToolPair(ref int y, ToolMode ma, GlyphKind ga, string ta, ToolMode mb, GlyphKind gb, string tb)
    {
        var a = MakeTool(ma,ga,ta); var b = MakeTool(mb,gb,tb); PlacePair(a,b,y); y += 27;
    }
    void AddToolSingleWithBlank(ref int y, ToolMode m, GlyphKind g, string t) { var a=MakeTool(m,g,t); var b=new Panel(); PlacePair(a,b,y); y += 27; }
    GlyphButton MakeTool(ToolMode m, GlyphKind g, string tip)
    {
        var b=new GlyphButton(g); b.Click += (_,_) => SetTool(m); toolButtons[m]=b; tips.SetToolTip(b,tip);
        if (m==ToolMode.Eraser)
        {
            b.MouseUp += (_,e) => { if(e.Button==MouseButtons.Right) ShowEraserMenu(b); };
        }
        return b;
    }
    void ShowEraserMenu(Control at)
    {
        var m=new ContextMenuStrip();
        m.Items.Add("Mão livre",null,(_,_)=>eraserShape=EraserShape.Freehand);
        m.Items.Add("Retângulo",null,(_,_)=>eraserShape=EraserShape.Rectangle);
        m.Items.Add("Círculo",null,(_,_)=>eraserShape=EraserShape.Circle);
        m.Show(at,new Point(at.Width,0));
    }
    void SetTool(ToolMode m) { tool=m; foreach(var kv in toolButtons) kv.Value.Selected=kv.Key==m; canvas.Invalidate(); }

    void AddPointerPair(ref int y, PointerMode ma, GlyphKind ga, string ta, PointerMode mb, GlyphKind gb, string tb)
    {
        var a=MakePointer(ma,ga,ta); var b=MakePointer(mb,gb,tb); PlacePair(a,b,y); y+=27;
    }
    GlyphButton MakePointer(PointerMode m, GlyphKind g, string tip)
    {
        var b=new GlyphButton(g); b.Click += (_,_) => SetPointer(pointer==m ? PointerMode.None : m); pointerButtons[m]=b; tips.SetToolTip(b,tip); return b;
    }
    void SetPointer(PointerMode m)
    {
        pointer=m; foreach(var kv in pointerButtons) kv.Value.Selected=kv.Key==m;
        CursorManager.Apply(m, penCursor); canvas.Invalidate();
    }

    GlyphButton MakeAction(GlyphKind g,string tip,Action act) { var b=new GlyphButton(g); b.Click += (_,_)=>act(); tips.SetToolTip(b,tip); return b; }
    Control MakeSelectButton() { var b=MakeTool(ToolMode.Select,GlyphKind.Select,"Selecionar área do print"); return b; }
    void AddActionPair(ref int y, Control a, Control b) { PlacePair(a,b,y); y+=27; }

    public bool IsToolbarPoint(Point screen) => Visible && Bounds.Contains(screen);

    public void RequestTextAt(Point screen, bool emoji)
    {
        BeginInvoke(new Action(() =>
        {
            using var dlg = new TextPromptForm(emoji);
            if (dlg.ShowDialog(this)==DialogResult.OK && !string.IsNullOrWhiteSpace(dlg.Value)) canvas.AddText(screen, dlg.Value, emoji, inkColor);
        }));
    }

    Bitmap CaptureCurrent()
    {
        bool wasVisible=Visible; Hide(); canvas.HideGuides=true; canvas.Invalidate(); Application.DoEvents(); Thread.Sleep(35);
        try
        {
            Rectangle r=canvas.CaptureScreenRect;
            var bmp=new Bitmap(Math.Max(1,r.Width),Math.Max(1,r.Height),PixelFormat.Format24bppRgb);
            using var g=Graphics.FromImage(bmp); g.CopyFromScreen(r.Location,Point.Empty,r.Size,CopyPixelOperation.SourceCopy); return bmp;
        }
        finally { canvas.HideGuides=false; canvas.Invalidate(); if(wasVisible) { Show(); BringToFront(); } }
    }

    void CopyCapture() { using var bmp=CaptureCurrent(); Clipboard.SetImage((Bitmap)bmp.Clone()); }
    void SaveCapture()
    {
        using var dlg=new SaveFileDialog { Filter="PNG (*.png)|*.png|JPG (*.jpg)|*.jpg|PDF (*.pdf)|*.pdf", AddExtension=true, FileName="PELEGO-captura" };
        if(dlg.ShowDialog(this)!=DialogResult.OK) return;
        using var bmp=CaptureCurrent(); string ext=Path.GetExtension(dlg.FileName).ToLowerInvariant();
        if(ext==".png") bmp.Save(dlg.FileName,ImageFormat.Png); else if(ext==".jpg"||ext==".jpeg") bmp.Save(dlg.FileName,ImageFormat.Jpeg); else PdfImageWriter.Save(dlg.FileName,bmp);
    }
    void PrintCapture()
    {
        using var bmp=CaptureCurrent(); using var pd=new PrintDocument();
        pd.PrintPage += (_,e) => { var m=e.MarginBounds; float s=Math.Min((float)m.Width/bmp.Width,(float)m.Height/bmp.Height); int w=(int)(bmp.Width*s),h=(int)(bmp.Height*s); e.Graphics.DrawImage(bmp,new Rectangle(m.Left,m.Top,w,h)); };
        using var dlg=new PrintDialog { Document=pd, UseEXDialog=true }; if(dlg.ShowDialog(this)==DialogResult.OK) pd.Print();
    }

    protected override void WndProc(ref Message m)
    {
        if(m.Msg==Native.WM_HOTKEY && m.WParam.ToInt32()==HOTKEY_COPY && expanded) { CopyCapture(); return; }
        base.WndProc(ref m);
    }

    void ExitApp()
    {
        allowExit=true; Native.UnregisterHotKey(Handle,HOTKEY_COPY); CursorManager.Restore(); tray.Visible=false; tray.Dispose(); canvas.Dispose(); penCursor.Dispose(); Application.Exit();
    }
}

sealed class GlyphButton : Button
{
    public GlyphKind Glyph { get; }
    public Color? Swatch { get; set; }
    bool selected;
    public bool Selected { get=>selected; set { selected=value; Invalidate(); } }
    public GlyphButton(GlyphKind glyph) { Glyph=glyph; FlatStyle=FlatStyle.Flat; FlatAppearance.BorderSize=1; BackColor=Color.FromArgb(245,245,245); TabStop=false; }
    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e); var g=e.Graphics; g.SmoothingMode=SmoothingMode.AntiAlias;
        if(Selected) { using var p=new Pen(Color.DodgerBlue,2); g.DrawRectangle(p,1,1,Width-3,Height-3); }
        if(Swatch.HasValue) { using var b=new SolidBrush(Swatch.Value); g.FillRectangle(b,5,5,Width-10,Height-10); using var p=new Pen(Color.DimGray); g.DrawRectangle(p,5,5,Width-11,Height-11); return; }
        using var pen=new Pen(Color.FromArgb(45,45,45),1.8f); using var brush=new SolidBrush(Color.FromArgb(45,45,45)); int cx=Width/2, cy=Height/2;
        switch(Glyph)
        {
            case GlyphKind.Width1: g.DrawLine(new Pen(Color.Black,1),5,cy,Width-5,cy); break;
            case GlyphKind.Width2: g.DrawLine(new Pen(Color.Black,2),5,cy,Width-5,cy); break;
            case GlyphKind.Width3: g.DrawLine(new Pen(Color.Black,4),5,cy,Width-5,cy); break;
            case GlyphKind.Width4: g.DrawLine(new Pen(Color.Black,7),5,cy,Width-5,cy); break;
            case GlyphKind.Pen: g.DrawLine(new Pen(Color.Black,3),6,18,18,6); g.FillEllipse(brush,4,17,5,5); break;
            case GlyphKind.Eraser: g.RotateTransform(-35,cx,cy); g.FillRectangle(Brushes.LightGray,6,8,13,9); g.DrawRectangle(Pens.DimGray,6,8,13,9); g.ResetTransform(); break;
            case GlyphKind.Line: g.DrawLine(pen,5,19,20,5); break;
            case GlyphKind.Arrow: DrawArrow(g,pen,new Point(5,19),new Point(20,5),false); break;
            case GlyphKind.DoubleArrow: DrawArrow(g,pen,new Point(5,19),new Point(20,5),true); break;
            case GlyphKind.Rect: g.DrawRectangle(pen,5,6,15,13); break;
            case GlyphKind.FilledRect: g.FillRectangle(brush,5,6,15,13); break;
            case GlyphKind.Ellipse: g.DrawEllipse(pen,5,6,15,13); break;
            case GlyphKind.FilledEllipse: g.FillEllipse(brush,5,6,15,13); break;
            case GlyphKind.Text: using(var f=new Font("Segoe UI",11,FontStyle.Bold)) g.DrawString("T",f,brush,6,3); break;
            case GlyphKind.Emoji: using(var f=new Font("Segoe UI Emoji",10)) g.DrawString("★",f,brush,3,4); break;
            case GlyphKind.Select: { var dp=(Pen)pen.Clone(); dp.DashStyle=DashStyle.Dash; g.DrawRectangle(dp,4,5,17,14); dp.Dispose(); } break;
            case GlyphKind.MouseCircle: g.DrawEllipse(pen,5,5,15,15); g.FillEllipse(brush,cx-1,cy-1,3,3); break;
            case GlyphKind.Target: g.DrawEllipse(pen,5,5,15,15); g.DrawLine(pen,cx,2,cx,23); g.DrawLine(pen,2,cy,23,cy); break;
            case GlyphKind.Hand: using(var f=new Font("Segoe UI Symbol",12)) g.DrawString("☝",f,brush,2,2); break;
            case GlyphKind.MousePen: g.DrawLine(new Pen(Color.Black,4),6,19,18,7); g.FillPolygon(brush,new[]{new Point(4,21),new Point(7,16),new Point(9,19)}); break;
            case GlyphKind.Undo: g.DrawArc(new Pen(Color.Black,2),5,6,15,13,190,250); g.FillPolygon(brush,new[]{new Point(4,10),new Point(4,5),new Point(9,8)}); break;
            case GlyphKind.Trash: g.DrawRectangle(pen,7,8,11,12); g.DrawLine(pen,5,7,20,7); g.DrawLine(pen,9,4,16,4); break;
            case GlyphKind.New: g.DrawRectangle(pen,6,5,13,16); g.DrawLine(pen,9,9,16,9); g.DrawLine(pen,12,6,12,13); break;
            case GlyphKind.Copy: g.DrawRectangle(pen,7,7,12,12); g.DrawRectangle(pen,4,4,12,12); break;
            case GlyphKind.Print: g.DrawRectangle(pen,6,4,13,7); g.DrawRectangle(pen,4,10,17,8); g.DrawRectangle(pen,7,15,11,6); break;
            case GlyphKind.Save: g.DrawRectangle(pen,5,4,15,17); g.FillRectangle(brush,8,5,8,5); g.DrawRectangle(pen,8,14,9,6); break;
        }
    }
    static void DrawArrow(Graphics g, Pen p, Point a, Point b, bool both)
    {
        using var cap=new AdjustableArrowCap(4,5,true); p.CustomEndCap=cap; if(both) { var c2=new AdjustableArrowCap(4,5,true); p.CustomStartCap=c2; } g.DrawLine(p,a,b);
    }
}

sealed class CanvasForm : Form
{
    readonly MainForm owner;
    readonly List<InkObject> objects=new();
    readonly Stack<IUndoRecord> undo=new();
    readonly System.Windows.Forms.Timer pointerTimer=new() { Interval=33 };
    IntPtr hook=IntPtr.Zero; Native.LowLevelMouseProc? proc;
    bool dragging, erasing, selecting, eraseChanged;
    Point start,current;
    readonly List<Point> stroke=new();
    List<EraseBackup>? eraseBackup;
    Rectangle? selection;
    public bool HideGuides { get; set; }

    public CanvasForm(MainForm owner)
    {
        this.owner=owner; FormBorderStyle=FormBorderStyle.None; ShowInTaskbar=false; TopMost=true; StartPosition=FormStartPosition.Manual;
        Bounds=SystemInformation.VirtualScreen; BackColor=Color.Fuchsia; TransparencyKey=Color.Fuchsia; DoubleBuffered=true;
        proc=HookProc; hook=Native.SetWindowsHookEx(Native.WH_MOUSE_LL,proc,Native.GetModuleHandle(null),0);
        pointerTimer.Tick += (_,_) => { if(owner.Pointer!=PointerMode.None && !HideGuides) Invalidate(); }; pointerTimer.Start();
    }
    protected override CreateParams CreateParams { get { var cp=base.CreateParams; cp.ExStyle |= Native.WS_EX_TOOLWINDOW|Native.WS_EX_NOACTIVATE|Native.WS_EX_TRANSPARENT; return cp; } }
    protected override bool ShowWithoutActivation => true;

    Point Local(Point screen)=>new(screen.X-Bounds.Left,screen.Y-Bounds.Top);
    public Rectangle CaptureScreenRect => selection.HasValue && selection.Value.Width>2 && selection.Value.Height>2 ? new Rectangle(selection.Value.X+Bounds.Left,selection.Value.Y+Bounds.Top,selection.Value.Width,selection.Value.Height) : Bounds;

    IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if(nCode<0) return Native.CallNextHookEx(hook,nCode,wParam,lParam);
        var ms=Marshal.PtrToStructure<Native.MSLLHOOKSTRUCT>(lParam); var screen=new Point(ms.pt.x,ms.pt.y); var p=Local(screen); int msg=wParam.ToInt32();
        if(owner.IsToolbarPoint(screen)) return Native.CallNextHookEx(hook,nCode,wParam,lParam);
        if(msg==Native.WM_RBUTTONDOWN && owner.Tool==ToolMode.Eraser)
        {
            DeleteObjectAt(p); return (IntPtr)1;
        }
        if(msg==Native.WM_LBUTTONDOWN)
        {
            start=current=p;
            if(owner.Tool==ToolMode.Text||owner.Tool==ToolMode.Emoji) { owner.RequestTextAt(screen,owner.Tool==ToolMode.Emoji); return (IntPtr)1; }
            if(owner.Tool==ToolMode.Select) { selecting=true; Invalidate(); return (IntPtr)1; }
            if(owner.Tool==ToolMode.Eraser)
            {
                erasing=true; eraseChanged=false; eraseBackup=objects.Where(o=>o.Visible).Select(o=>new EraseBackup(o,(Bitmap)o.Layer.Clone())).ToList(); ApplyEraser(p); return (IntPtr)1;
            }
            dragging=true; stroke.Clear(); stroke.Add(p); Invalidate(); return (IntPtr)1;
        }
        if(msg==Native.WM_MOUSEMOVE)
        {
            current=p;
            if(dragging) { if(owner.Tool==ToolMode.Pen) stroke.Add(p); Invalidate(); }
            if(selecting) Invalidate();
            if(erasing) ApplyEraser(p);
            if(owner.Pointer!=PointerMode.None) Invalidate();
            return Native.CallNextHookEx(hook,nCode,wParam,lParam);
        }
        if(msg==Native.WM_LBUTTONUP)
        {
            current=p;
            if(dragging) { dragging=false; if(owner.Tool==ToolMode.Pen) stroke.Add(p); CommitShape(); Invalidate(); return (IntPtr)1; }
            if(selecting) { selecting=false; selection=Normalize(start,current); Invalidate(); return (IntPtr)1; }
            if(erasing) { erasing=false; if(eraseChanged && eraseBackup!=null) undo.Push(new EraseUndo(eraseBackup)); else eraseBackup?.ForEach(x=>x.Before.Dispose()); eraseBackup=null; Invalidate(); return (IntPtr)1; }
        }
        return Native.CallNextHookEx(hook,nCode,wParam,lParam);
    }

    void CommitShape()
    {
        InkObject? obj=InkObject.Create(owner.Tool, stroke.Count>1?stroke:new List<Point>{start,current}, owner.InkColor, owner.InkWidth, start,current);
        if(obj==null) return; objects.Add(obj); undo.Push(new AddUndo(objects,obj));
    }

    public void AddText(Point screen,string text,bool emoji,Color color)
    {
        var p=Local(screen); var obj=InkObject.CreateText(p,text,emoji,color); objects.Add(obj); undo.Push(new AddUndo(objects,obj)); Invalidate();
    }

    void ApplyEraser(Point p)
    {
        int size=(int)Math.Max(6,owner.InkWidth*3.0f); var stamp=new Rectangle(p.X-size/2,p.Y-size/2,size,size);
        foreach(var obj in objects.Where(o=>o.Visible && o.Bounds.IntersectsWith(stamp)))
        {
            using var g=Graphics.FromImage(obj.Layer); g.CompositingMode=CompositingMode.SourceCopy; using var b=new SolidBrush(Color.Transparent);
            var local=new Rectangle(stamp.X-obj.Bounds.X,stamp.Y-obj.Bounds.Y,stamp.Width,stamp.Height);
            if(owner.EraserShape==EraserShape.Rectangle) g.FillRectangle(b,local); else g.FillEllipse(b,local); eraseChanged=true;
        }
        Invalidate();
    }

    void DeleteObjectAt(Point p)
    {
        for(int i=objects.Count-1;i>=0;i--)
        {
            var o=objects[i]; if(!o.Visible||!o.HitTest(p)) continue; o.Visible=false; undo.Push(new DeleteUndo(o)); Invalidate(); return;
        }
    }

    public void Undo() { if(undo.Count==0) return; undo.Pop().Undo(); Invalidate(); }
    public void ClearDrawings()
    {
        var visible=objects.Where(o=>o.Visible).ToList(); if(visible.Count==0) return; foreach(var o in visible) o.Visible=false; undo.Push(new ClearUndo(visible)); Invalidate();
    }
    public void NewCanvas() { ClearDrawings(); selection=null; Invalidate(); }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e); var g=e.Graphics; g.SmoothingMode=SmoothingMode.AntiAlias;
        foreach(var o in objects.Where(o=>o.Visible)) g.DrawImageUnscaled(o.Layer,o.Bounds.Location);
        if(dragging) DrawPreview(g);
        if(!HideGuides)
        {
            Rectangle? r=selecting?Normalize(start,current):selection; if(r.HasValue && r.Value.Width>1 && r.Value.Height>1) DrawSelection(g,r.Value);
            DrawPointerEffect(g);
        }
    }

    void DrawPreview(Graphics g)
    {
        using var p=new Pen(owner.InkColor,owner.InkWidth) { StartCap=LineCap.Round,EndCap=LineCap.Round,LineJoin=LineJoin.Round };
        if(owner.Tool==ToolMode.Pen && stroke.Count>1) g.DrawLines(p,stroke.ToArray());
        else if(owner.Tool==ToolMode.Line) g.DrawLine(p,start,current);
        else if(owner.Tool==ToolMode.Arrow||owner.Tool==ToolMode.DoubleArrow) { using var cap=new AdjustableArrowCap(5,6,true); p.CustomEndCap=cap; if(owner.Tool==ToolMode.DoubleArrow) p.CustomStartCap=new AdjustableArrowCap(5,6,true); g.DrawLine(p,start,current); }
        else { var r=Normalize(start,current); if(owner.Tool==ToolMode.Rectangle||owner.Tool==ToolMode.FilledRectangle) { if(owner.Tool==ToolMode.FilledRectangle) using(var b=new SolidBrush(Color.FromArgb(90,owner.InkColor))) g.FillRectangle(b,r); g.DrawRectangle(p,r); } if(owner.Tool==ToolMode.Ellipse||owner.Tool==ToolMode.FilledEllipse) { if(owner.Tool==ToolMode.FilledEllipse) using(var b=new SolidBrush(Color.FromArgb(90,owner.InkColor))) g.FillEllipse(b,r); g.DrawEllipse(p,r); } }
    }

    static void DrawSelection(Graphics g,Rectangle r)
    {
        using var p1=new Pen(Color.White,3){DashStyle=DashStyle.Dash}; using var p2=new Pen(Color.Black,1){DashStyle=DashStyle.Dash}; g.DrawRectangle(p1,r); g.DrawRectangle(p2,r);
    }
    void DrawPointerEffect(Graphics g)
    {
        if(owner.Pointer==PointerMode.None) return; var s=Cursor.Position; var p=Local(s); if(p.X<0||p.Y<0||p.X>Width||p.Y>Height) return;
        using var pen=new Pen(Color.FromArgb(220,30,30,30),2);
        if(owner.Pointer==PointerMode.Circle) g.DrawEllipse(pen,p.X-18,p.Y-18,36,36);
        if(owner.Pointer==PointerMode.Target) { g.DrawEllipse(pen,p.X-16,p.Y-16,32,32); g.DrawLine(pen,p.X-24,p.Y,p.X+24,p.Y); g.DrawLine(pen,p.X,p.Y-24,p.X,p.Y+24); }
        if(owner.Pointer==PointerMode.Hand)
        {
            int t=Environment.TickCount/100; for(int i=0;i<5;i++) { double a=(i*1.256)+(t%10)*0.12; int x=p.X+(int)(Math.Cos(a)*24), y=p.Y+(int)(Math.Sin(a)*20); DrawStar(g,x,y); }
        }
    }
    static void DrawStar(Graphics g,int x,int y) { using var p=new Pen(Color.Gold,2); g.DrawLine(p,x-4,y,x+4,y); g.DrawLine(p,x,y-4,x,y+4); g.DrawLine(p,x-3,y-3,x+3,y+3); g.DrawLine(p,x-3,y+3,x+3,y-3); }
    static Rectangle Normalize(Point a,Point b) => Rectangle.FromLTRB(Math.Min(a.X,b.X),Math.Min(a.Y,b.Y),Math.Max(a.X,b.X),Math.Max(a.Y,b.Y));

    protected override void Dispose(bool disposing)
    {
        if(disposing) { pointerTimer.Stop(); if(hook!=IntPtr.Zero) Native.UnhookWindowsHookEx(hook); foreach(var o in objects) o.Dispose(); while(undo.Count>0) undo.Pop().Dispose(); }
        base.Dispose(disposing);
    }
}

sealed class InkObject : IDisposable
{
    public Bitmap Layer { get; set; }
    public Rectangle Bounds { get; }
    public bool Visible { get; set; }=true;
    InkObject(Bitmap layer,Rectangle bounds){Layer=layer;Bounds=bounds;}

    public static InkObject? Create(ToolMode mode,List<Point> pts,Color color,float width,Point a,Point b)
    {
        if(mode is ToolMode.Text or ToolMode.Emoji or ToolMode.Select or ToolMode.Eraser) return null;
        Rectangle bounds; int pad=(int)Math.Ceiling(width+12);
        if(mode==ToolMode.Pen) { int minx=pts.Min(p=>p.X),miny=pts.Min(p=>p.Y),maxx=pts.Max(p=>p.X),maxy=pts.Max(p=>p.Y); bounds=Rectangle.FromLTRB(minx-pad,miny-pad,maxx+pad+1,maxy+pad+1); }
        else { bounds=Rectangle.FromLTRB(Math.Min(a.X,b.X)-pad,Math.Min(a.Y,b.Y)-pad,Math.Max(a.X,b.X)+pad+1,Math.Max(a.Y,b.Y)+pad+1); }
        if(bounds.Width<2||bounds.Height<2) return null;
        var bmp=new Bitmap(bounds.Width,bounds.Height,PixelFormat.Format32bppArgb); using var g=Graphics.FromImage(bmp); g.SmoothingMode=SmoothingMode.AntiAlias; g.TranslateTransform(-bounds.X,-bounds.Y);
        using var pen=new Pen(color,width){StartCap=LineCap.Round,EndCap=LineCap.Round,LineJoin=LineJoin.Round};
        switch(mode)
        {
            case ToolMode.Pen: if(pts.Count>1) g.DrawLines(pen,pts.ToArray()); break;
            case ToolMode.Line: g.DrawLine(pen,a,b); break;
            case ToolMode.Arrow: using(var cap=new AdjustableArrowCap(Math.Max(4,width*1.5f),Math.Max(5,width*2),true)){pen.CustomEndCap=cap;g.DrawLine(pen,a,b);} break;
            case ToolMode.DoubleArrow:
                using(var c1=new AdjustableArrowCap(Math.Max(4,width*1.5f),Math.Max(5,width*2),true)) using(var c2=new AdjustableArrowCap(Math.Max(4,width*1.5f),Math.Max(5,width*2),true)){pen.CustomStartCap=c1;pen.CustomEndCap=c2;g.DrawLine(pen,a,b);} break;
            case ToolMode.Rectangle: g.DrawRectangle(pen,Normalize(a,b)); break;
            case ToolMode.FilledRectangle: { var r=Normalize(a,b); using var br=new SolidBrush(Color.FromArgb(110,color)); g.FillRectangle(br,r); g.DrawRectangle(pen,r); } break;
            case ToolMode.Ellipse: g.DrawEllipse(pen,Normalize(a,b)); break;
            case ToolMode.FilledEllipse: { var r=Normalize(a,b); using var br=new SolidBrush(Color.FromArgb(110,color)); g.FillEllipse(br,r); g.DrawEllipse(pen,r); } break;
        }
        g.ResetTransform(); return new InkObject(bmp,bounds);
    }
    public static InkObject CreateText(Point p,string text,bool emoji,Color color)
    {
        using var font=new Font(emoji?"Segoe UI Emoji":"Segoe UI",emoji?28:22,emoji?FontStyle.Regular:FontStyle.Bold,GraphicsUnit.Pixel);
        Size sz=TextRenderer.MeasureText(text,font); var bounds=new Rectangle(p.X,p.Y,Math.Max(10,sz.Width+8),Math.Max(10,sz.Height+8)); var bmp=new Bitmap(bounds.Width,bounds.Height,PixelFormat.Format32bppArgb);
        using var g=Graphics.FromImage(bmp); g.SmoothingMode=SmoothingMode.AntiAlias; using var br=new SolidBrush(color); g.DrawString(text,font,br,2,2); return new InkObject(bmp,bounds);
    }
    public bool HitTest(Point p)
    {
        if(!Bounds.Contains(p)) return false; int x=p.X-Bounds.X,y=p.Y-Bounds.Y; for(int yy=Math.Max(0,y-4);yy<=Math.Min(Layer.Height-1,y+4);yy++) for(int xx=Math.Max(0,x-4);xx<=Math.Min(Layer.Width-1,x+4);xx++) if(Layer.GetPixel(xx,yy).A>30) return true; return false;
    }
    static Rectangle Normalize(Point a,Point b)=>Rectangle.FromLTRB(Math.Min(a.X,b.X),Math.Min(a.Y,b.Y),Math.Max(a.X,b.X),Math.Max(a.Y,b.Y));
    public void Dispose()=>Layer.Dispose();
}

interface IUndoRecord : IDisposable { void Undo(); }
sealed class AddUndo : IUndoRecord { readonly List<InkObject> list; readonly InkObject obj; public AddUndo(List<InkObject> l,InkObject o){list=l;obj=o;} public void Undo(){list.Remove(obj);obj.Dispose();} public void Dispose(){} }
sealed class DeleteUndo : IUndoRecord { readonly InkObject obj; public DeleteUndo(InkObject o){obj=o;} public void Undo()=>obj.Visible=true; public void Dispose(){} }
sealed class ClearUndo : IUndoRecord { readonly List<InkObject> objs; public ClearUndo(List<InkObject> o){objs=o;} public void Undo(){foreach(var x in objs)x.Visible=true;} public void Dispose(){} }
sealed record EraseBackup(InkObject Object, Bitmap Before);
sealed class EraseUndo : IUndoRecord
{
    readonly List<EraseBackup> backups; public EraseUndo(List<EraseBackup> b){backups=b;}
    public void Undo(){foreach(var b in backups){b.Object.Layer.Dispose();b.Object.Layer=(Bitmap)b.Before.Clone();} }
    public void Dispose(){foreach(var b in backups)b.Before.Dispose();}
}

sealed class TextPromptForm : Form
{
    readonly TextBox box=new(); public string Value=>box.Text;
    public TextPromptForm(bool emoji)
    {
        Text=emoji?"Inserir emoji":"Inserir texto"; FormBorderStyle=FormBorderStyle.FixedDialog; StartPosition=FormStartPosition.CenterParent; ClientSize=new Size(330,92); MaximizeBox=false;MinimizeBox=false;TopMost=true;
        box.SetBounds(10,10,310,28); if(emoji) box.Text="⭐"; Controls.Add(box); var ok=new Button{Text="OK",DialogResult=DialogResult.OK,Left=165,Top=50,Width=75}; var cancel=new Button{Text="Cancelar",DialogResult=DialogResult.Cancel,Left=245,Top=50,Width=75}; Controls.Add(ok);Controls.Add(cancel);AcceptButton=ok;CancelButton=cancel;
    }
}

static class CursorFactory
{
    public static Cursor CreatePenCursor()
    {
        var bmp=new Bitmap(32,32,PixelFormat.Format32bppArgb); using(var g=Graphics.FromImage(bmp)){g.SmoothingMode=SmoothingMode.AntiAlias; using var body=new Pen(Color.FromArgb(45,45,45),6){StartCap=LineCap.Round,EndCap=LineCap.Round}; g.DrawLine(body,25,5,8,22); using var hi=new Pen(Color.Silver,2); g.DrawLine(hi,23,6,10,19); using var nib=new SolidBrush(Color.Goldenrod); g.FillPolygon(nib,new[]{new Point(6,26),new Point(8,20),new Point(12,24)});}
        IntPtr hColor=bmp.GetHbitmap(Color.Transparent); using var mask=new Bitmap(32,32,PixelFormat.Format1bppIndexed); IntPtr hMask=mask.GetHbitmap(); var ii=new Native.ICONINFO{fIcon=false,xHotspot=7,yHotspot=25,hbmColor=hColor,hbmMask=hMask}; IntPtr h=Native.CreateIconIndirect(ref ii); Native.DeleteObject(hColor); Native.DeleteObject(hMask); bmp.Dispose(); return new Cursor(h);
    }
}

static class CursorManager
{
    static readonly uint[] ids={32512,32513,32515,32649};
    public static void Apply(PointerMode mode,Cursor pen)
    {
        Restore(); if(mode==PointerMode.Hand) foreach(var id in ids) Native.SetSystemCursor(Native.CopyIcon(Cursors.Hand.Handle),id); else if(mode==PointerMode.Pen) foreach(var id in ids) Native.SetSystemCursor(Native.CopyIcon(pen.Handle),id); else if(mode==PointerMode.Target) foreach(var id in ids) Native.SetSystemCursor(Native.CopyIcon(Cursors.Cross.Handle),id);
    }
    public static void Restore()=>Native.SystemParametersInfo(0x0057,0,IntPtr.Zero,0);
}

static class PdfImageWriter
{
    public static void Save(string path,Bitmap bmp)
    {
        using var jpg=new MemoryStream(); var enc=ImageCodecInfo.GetImageEncoders().First(x=>x.FormatID==ImageFormat.Jpeg.Guid); using(var ep=new EncoderParameters(1)){ep.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,92L);bmp.Save(jpg,enc,ep);} byte[] img=jpg.ToArray();
        double pw=bmp.Width*72.0/96.0, ph=bmp.Height*72.0/96.0; using var ms=new MemoryStream(); var offs=new List<long>{0}; void W(string s){var b=Encoding.ASCII.GetBytes(s);ms.Write(b,0,b.Length);} W("%PDF-1.4\n");
        void Obj(int n,string body){offs.Add(ms.Position);W($"{n} 0 obj\n{body}\nendobj\n");}
        Obj(1,"<< /Type /Catalog /Pages 2 0 R >>"); Obj(2,"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"); Obj(3,$"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {pw:0.##} {ph:0.##}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
        offs.Add(ms.Position); W($"4 0 obj\n<< /Type /XObject /Subtype /Image /Width {bmp.Width} /Height {bmp.Height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {img.Length} >>\nstream\n"); ms.Write(img,0,img.Length); W("\nendstream\nendobj\n");
        string content=$"q {pw:0.##} 0 0 {ph:0.##} 0 0 cm /Im0 Do Q"; Obj(5,$"<< /Length {content.Length} >>\nstream\n{content}\nendstream"); long xref=ms.Position; W("xref\n0 6\n0000000000 65535 f \n"); for(int i=1;i<=5;i++)W($"{offs[i]:0000000000} 00000 n \n"); W($"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"); File.WriteAllBytes(path,ms.ToArray());
    }
}

static class Native
{
    public const int WH_MOUSE_LL=14, WM_LBUTTONDOWN=0x0201, WM_LBUTTONUP=0x0202, WM_RBUTTONDOWN=0x0204, WM_MOUSEMOVE=0x0200, WM_HOTKEY=0x0312;
    public const int WS_EX_TOOLWINDOW=0x00000080, WS_EX_NOACTIVATE=0x08000000, WS_EX_TRANSPARENT=0x00000020; public const uint MOD_CONTROL=0x0002;
    public delegate IntPtr LowLevelMouseProc(int nCode,IntPtr wParam,IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)] public struct POINT{public int x,y;}
    [StructLayout(LayoutKind.Sequential)] public struct MSLLHOOKSTRUCT{public POINT pt;public uint mouseData,flags,time;public IntPtr dwExtraInfo;}
    [StructLayout(LayoutKind.Sequential)] public struct ICONINFO{[MarshalAs(UnmanagedType.Bool)]public bool fIcon;public uint xHotspot,yHotspot;public IntPtr hbmMask,hbmColor;}
    [DllImport("user32.dll",SetLastError=true)] public static extern IntPtr SetWindowsHookEx(int idHook,LowLevelMouseProc lpfn,IntPtr hMod,uint threadId);
    [DllImport("user32.dll")] public static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")] public static extern IntPtr CallNextHookEx(IntPtr hhk,int nCode,IntPtr wParam,IntPtr lParam);
    [DllImport("kernel32.dll",CharSet=CharSet.Auto)] public static extern IntPtr GetModuleHandle(string? lpModuleName);
    [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd,int id,uint fsModifiers,uint vk);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd,int id);
    [DllImport("user32.dll")] public static extern bool SetSystemCursor(IntPtr hcur,uint id);
    [DllImport("user32.dll")] public static extern IntPtr CopyIcon(IntPtr hIcon);
    [DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint uiAction,uint uiParam,IntPtr pvParam,uint fWinIni);
    [DllImport("user32.dll")] public static extern IntPtr CreateIconIndirect(ref ICONINFO icon);
    [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr hObject);
}
