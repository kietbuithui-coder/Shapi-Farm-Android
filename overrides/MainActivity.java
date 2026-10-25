package vn.shapifarm.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Bitmap;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.widget.Button;
import java.lang.ref.WeakReference;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.webkit.ValueCallback;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Online WebView shell with pre-bundled *static* artwork and sound.
 * Auth, saves, multiplayer, HTML and JS continue to be handled by the website.
 * Local assets are enabled ONLY if the deployed site publishes the matching
 * SHA-256 marker (public/android-assets-version.txt); otherwise network wins.
 */
public class MainActivity extends Activity {
    private static final String GAME_URL = "https://shapifarm.kietbuithui.chatgpt.site/";
    private static final String GAME_HOST = "shapifarm.kietbuithui.chatgpt.site";
    private static final String VERSION_URL = GAME_URL + "android-assets-version.txt";
    private static final int FILE_PICKER_REQUEST = 6702;
    private volatile boolean useBundledAssets = false;
    private WebView game;
    private TextView progressText;
    private View loading;
    private ValueCallback<Uri[]> fileUpload;
    private FrameLayout root;
    private LinearLayout panel;
    private Button retryButton;
    private View browserHelp;
    private volatile boolean destroyed;
    private boolean pageFailed;
    private Bundle restoredWebState;
    private Thread versionThread;
    private String lastFailure = "";
    private RuntimeException startupError;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        hideSystemUi();

        restoredWebState = savedInstanceState == null ? null : savedInstanceState.getBundle("webState");
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(23, 38, 28));


        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setBackgroundColor(Color.rgb(23, 38, 28));
        TextView title = new TextView(this);
        title.setText("🌙 Hẹn Nhau Dưới Ánh Trăng");
        title.setTextColor(Color.WHITE);
        title.setTextSize(19);
        title.setGravity(Gravity.CENTER);
        panel.addView(title);
        ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setIndeterminate(true);
        LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(-1, 6);
        int gap = (int)(getResources().getDisplayMetrics().density * 48);
        barParams.setMargins(gap, 24, gap, 14);
        panel.addView(bar, barParams);
        progressText = new TextView(this);
        progressText.setText("Đang kiểm tra tài nguyên có sẵn…");
        progressText.setTextColor(Color.rgb(204, 223, 206));
        progressText.setGravity(Gravity.CENTER);
        panel.addView(progressText);
        retryButton = new Button(this);
        retryButton.setText("Thử mở lại game");
        retryButton.setVisibility(View.GONE);
        retryButton.setOnClickListener(v -> { restoredWebState = null; recreate(); });
        panel.addView(retryButton);
        Button browser = new Button(this);
        browser.setText("Mở game bằng trình duyệt");
        browser.setOnClickListener(v -> openBrowser());
        panel.addView(browser);
        root.addView(panel, new FrameLayout.LayoutParams(-1, -1));
        loading = panel;
        setContentView(root);

        LinearLayout help = new LinearLayout(this);
        help.setOrientation(LinearLayout.VERTICAL);
        help.setBackgroundColor(Color.rgb(23, 38, 28));
        TextView hint = new TextView(this);
        hint.setText("Nếu đăng nhập gặp lỗi, có thể chơi bằng trình duyệt. Chế độ này tải tài nguyên qua mạng.");
        hint.setTextColor(Color.WHITE);
        hint.setTextSize(12);
        help.addView(hint);
        Button browserLogin = new Button(this);
        browserLogin.setText("Đăng nhập bằng trình duyệt");
        browserLogin.setOnClickListener(v -> openBrowser());
        help.addView(browserLogin);
        FrameLayout.LayoutParams helpParams = new FrameLayout.LayoutParams(-1, -2, Gravity.TOP);
        root.addView(help, helpParams);
        browserHelp = help;
        help.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> updateGameInsets());
        help.setVisibility(View.GONE);
        try {
            game = new WebView(this);
            game.setBackgroundColor(Color.rgb(23, 38, 28));
            root.addView(game, 0, new FrameLayout.LayoutParams(-1, -1));
            configureWebView();
        } catch (RuntimeException ex) {
            startupError = ex;
            android.util.Log.e("ShapiWebView", "WebView initialization failed", ex);
            discardWebView(game);
            showFailure("Không khởi động được Android System WebView. Hãy cập nhật WebView/Chrome hoặc mở bằng trình duyệt.");
            return;
        }
        startVersionCheck();
    }

    private void configureWebView() {
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);

        game.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return localAsset(request);
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                if (destroyed || view != game) return;
                pageFailed = false;
                showBrowserHelp(isSignInPage(url));
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!destroyed && view == game && !pageFailed) loading.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && view == game && !destroyed)
                    showFailure("Chưa mở được trang đăng nhập/game. Kiểm tra mạng, thử lại hoặc mở bằng trình duyệt.");
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // Android 8+: an unhandled renderer termination also kills the host app.
                // The dead WebView must NEVER be used or reloaded.
                boolean current = view == game;
                discardWebView(view);
                if (current && !destroyed) showFailure(detail.didCrash()
                    ? "WebView gặp lỗi khi mở game/đăng nhập. Thử lại hoặc mở bằng trình duyệt."
                    : "Android đã dừng phần hiển thị game. Đóng bớt ứng dụng rồi thử lại, hoặc mở bằng trình duyệt.");
                return true;
            }
        });
        game.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int percent) {
                if (!destroyed && view == game && !pageFailed && progressText != null) progressText.setText("Đang mở game " + percent + "%");
            }
            @Override public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                    FileChooserParams parameters) {
                if (fileUpload != null) fileUpload.onReceiveValue(null);
                fileUpload = callback;
                try {
                    startActivityForResult(parameters.createIntent(), FILE_PICKER_REQUEST);
                } catch (ActivityNotFoundException ex) {
                    fileUpload = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                ServiceWorkerController.getInstance().setServiceWorkerClient(new AssetWorkerClient(this));
            } catch (RuntimeException ex) {
                // This optimization is optional: older/broken providers may not expose it.
                // Ordinary WebView requests can still use local assets; worker requests use HTTPS.
                android.util.Log.w("ShapiWebView", "Service worker interception unavailable; using network fallback", ex);
            }
        }

    }

    // No callback may touch a destroyed Activity, including after rotation or leaving login.
    private void startVersionCheck() {
        versionThread = new Thread(() -> {
            final boolean valid = checkVersion();
            runOnUiThread(() -> finishStartup(valid));
        }, "shapi-asset-version");
        versionThread.start();
    }

    void finishStartup(boolean valid) {
        if (destroyed || isFinishing() || isDestroyed() || game == null) return;
        useBundledAssets = valid;
        progressText.setText(valid ? "Tài nguyên đồ họa đã có sẵn trên máy" :
                "Tải tài nguyên từ website (chưa đồng bộ bản APK)");
        if (restoredWebState == null || game.restoreState(restoredWebState) == null) game.loadUrl(GAME_URL);
        restoredWebState = null;
    }

    static boolean isSignInPage(String value) {
        Uri uri = Uri.parse(value);
        return "https".equalsIgnoreCase(uri.getScheme()) &&
                (!GAME_HOST.equalsIgnoreCase(uri.getHost()) || "/signin-with-chatgpt".equals(uri.getPath()));
    }

    private void showBrowserHelp(boolean visible) {
        browserHelp.setVisibility(visible ? View.VISIBLE : View.GONE);
        updateGameInsets();
    }

    private void updateGameInsets() {
        if (destroyed || game == null || browserHelp == null) return;
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) game.getLayoutParams();
        int margin = browserHelp.getVisibility() == View.VISIBLE ? browserHelp.getHeight() : 0;
        if (params.topMargin != margin) { params.topMargin = margin; game.setLayoutParams(params); }
    }

    private void showFailure(String message) {
        if (destroyed) return;
        pageFailed = true;
        lastFailure = message;
        progressText.setText(message);
        retryButton.setVisibility(View.VISIBLE);
        browserHelp.setVisibility(View.GONE);
        loading.setVisibility(View.VISIBLE);
        loading.bringToFront();
    }

    private void discardWebView(WebView view) {
        if (view == null) return;
        if (view == game) {
            game = null;
            if (fileUpload != null) { fileUpload.onReceiveValue(null); fileUpload = null; }
        }
        if (view.getParent() instanceof ViewGroup) ((ViewGroup)view.getParent()).removeView(view);
        // Do not call stopLoading, loadUrl or any other renderer API after its process is gone.
        view.destroy();
    }

    private void openBrowser() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(GAME_URL))
                    .addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException ex) {
            showFailure("Cần bật hoặc cài Chrome/trình duyệt để dùng chế độ này.");
        }
    }

    private static final class AssetWorkerClient extends ServiceWorkerClient {
        private final WeakReference<MainActivity> owner;
        AssetWorkerClient(MainActivity activity) { owner = new WeakReference<>(activity); }
        @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
            MainActivity activity = owner.get();
            return activity == null || activity.destroyed ? null : activity.localAsset(request);
        }
    }

    boolean checkVersion() {
        String local;
        try (InputStream in = getAssets().open("bundle-version.txt");
             BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            local = reader.readLine();
        } catch (IOException ex) { return false; }
        if (local == null || !local.startsWith("shapi-3.6-")) return false;
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(VERSION_URL + "?apk=36").openConnection();
            connection.setConnectTimeout(2200);
            connection.setReadTimeout(2200);
            connection.setUseCaches(false);
            if (connection.getResponseCode() != 200) return false;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    connection.getInputStream(), StandardCharsets.UTF_8))) {
                return local.equals(reader.readLine());
            }
        } catch (IOException ex) { return false; }
        finally { if (connection != null) connection.disconnect(); }
    }

    private WebResourceResponse localAsset(WebResourceRequest request) {
        if (destroyed || !useBundledAssets || !"GET".equalsIgnoreCase(request.getMethod())) return null;
        Uri url = request.getUrl();
        if (!"https".equalsIgnoreCase(url.getScheme()) || !GAME_HOST.equalsIgnoreCase(url.getHost())) return null;
        // Media byte ranges must remain network-served (206 Partial Content).
        for (String header : request.getRequestHeaders().keySet()) if ("Range".equalsIgnoreCase(header)) return null;
        String path = url.getPath();
        if (path == null || path.contains("..") || path.contains("\\") || path.contains("//")) return null;
        if (!(path.startsWith("/assets/") || path.startsWith("/icons/") ||
                path.startsWith("/fonts/") || path.equals("/favicon.svg") ||
                path.equals("/manifest.webmanifest"))) return null;
        try {
            InputStream content = getAssets().open("web" + path);
            WebResourceResponse response = new WebResourceResponse(mime(path), "UTF-8", content);
            Map<String,String> headers = new HashMap<>();
            headers.put("Cache-Control", "public, max-age=31536000, immutable");
            response.setResponseHeaders(headers);
            return response;
        } catch (IOException ex) { return null; } // Missing files always use the website.
    }

    private static String mime(String file) {
        String f = file.toLowerCase(java.util.Locale.ROOT);
        if (f.endsWith(".png")) return "image/png";
        if (f.endsWith(".jpg") || f.endsWith(".jpeg")) return "image/jpeg";
        if (f.endsWith(".webp")) return "image/webp";
        if (f.endsWith(".gif")) return "image/gif";
        if (f.endsWith(".svg")) return "image/svg+xml";
        if (f.endsWith(".mp3")) return "audio/mpeg";
        if (f.endsWith(".ogg")) return "audio/ogg";
        if (f.endsWith(".wav")) return "audio/wav";
        if (f.endsWith(".ttf")) return "font/ttf";
        if (f.endsWith(".woff2")) return "font/woff2";
        if (f.endsWith(".webmanifest") || f.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }
    @Override public void onBackPressed() {
        if (game != null && game.canGoBack()) game.goBack();
        else new AlertDialog.Builder(this).setMessage("Thoát game?")
                .setNegativeButton("Ở lại", null).setPositiveButton("Thoát", (dialog, which) -> finish()).show();
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_PICKER_REQUEST && fileUpload != null) {
            fileUpload.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileUpload = null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        if (game != null && !pageFailed) {
            Bundle webState = new Bundle();
            game.saveState(webState);
            state.putBundle("webState", webState);
        }
        super.onSaveInstanceState(state);
    }
    @Override protected void onPause() {
        if (game != null) game.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (game != null) game.onResume();
    }
    @Override protected void onDestroy() {
        destroyed = true;
        useBundledAssets = false;
        if (versionThread != null) versionThread.interrupt();
        if (fileUpload != null) { fileUpload.onReceiveValue(null); fileUpload = null; }
        discardWebView(game);
        super.onDestroy();
    }
}
