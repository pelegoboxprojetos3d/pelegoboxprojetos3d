package br.com.pelegobox.radio;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private ApprovedLayoutView layoutView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        hideSystemBars();
        layoutView = new ApprovedLayoutView();
        setContentView(layoutView);
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
    }

    private void hideSystemBars() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    private final class ApprovedLayoutView extends View {
        private final Bitmap layout;
        private final Paint imagePaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        private final Paint touchPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private float scale;
        private float offsetX;
        private float offsetY;
        private float pressedX = -1f;
        private float pressedY = -1f;

        ApprovedLayoutView() {
            super(MainActivity.this);
            setBackgroundColor(Color.rgb(0, 6, 5));
            layout = BitmapFactory.decodeResource(getResources(), R.drawable.layout_aprovado);
            touchPaint.setColor(Color.argb(70, 0, 255, 70));
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            if (layout == null) return;
            scale = Math.min(getWidth() / (float) layout.getWidth(),
                    getHeight() / (float) layout.getHeight());
            float width = layout.getWidth() * scale;
            float height = layout.getHeight() * scale;
            offsetX = (getWidth() - width) / 2f;
            offsetY = (getHeight() - height) / 2f;
            RectF target = new RectF(offsetX, offsetY, offsetX + width, offsetY + height);
            canvas.drawBitmap(layout, null, target, imagePaint);
            if (pressedX >= 0f && pressedY >= 0f) {
                canvas.drawCircle(pressedX, pressedY, 26f, touchPaint);
            }
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            if (layout == null || scale <= 0f) return true;
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                pressedX = event.getX();
                pressedY = event.getY();
                invalidate();
                return true;
            }
            if (event.getAction() == MotionEvent.ACTION_UP) {
                float x = (event.getX() - offsetX) / scale;
                float y = (event.getY() - offsetY) / scale;
                pressedX = -1f;
                pressedY = -1f;
                invalidate();
                handleTap(x, y);
                return true;
            }
            if (event.getAction() == MotionEvent.ACTION_CANCEL) {
                pressedX = -1f;
                pressedY = -1f;
                invalidate();
            }
            return true;
        }

        private void handleTap(float x, float y) {
            if (x >= 1430 && y <= 80) {
                finish();
                return;
            }
            if (y >= 855 && x >= 630 && x <= 1110) {
                Intent intent = new Intent(Intent.ACTION_DELETE,
                        Uri.parse("package:" + getPackageName()));
                startActivity(intent);
                return;
            }
            String action = null;
            if (x >= 1110 && y >= 590 && y <= 650) action = "TOCAR";
            else if (x >= 1280 && y >= 590 && y <= 650) action = "PRÓXIMA";
            else if (x >= 1460 && y >= 590 && y <= 650) action = "PARAR";
            else if (y >= 850 && x <= 310) action = "SALVAR";
            else if (y >= 850 && x <= 630) action = "OCULTAR";
            else if (y >= 355 && y <= 420 && x <= 1080) action = "PROJETO";
            else if (y >= 455 && y <= 635 && x <= 1080) action = "ESTILO MUSICAL";
            if (action != null) {
                Toast.makeText(MainActivity.this, action, Toast.LENGTH_SHORT).show();
            }
        }
    }
}
