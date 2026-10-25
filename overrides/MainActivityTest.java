package vn.shapifarm.game;

import android.os.Bundle;
import android.os.Looper;
import android.net.Uri;
import android.view.View;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import java.lang.reflect.Field;
import java.util.Collections;
import java.util.Map;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {26, 30, 35})
public class MainActivityTest {
    public static class OfflineActivity extends MainActivity {
        @Override boolean checkVersion() { return false; }
    }
    private Object get(MainActivity activity, String name) throws Exception {
        Field field = MainActivity.class.getDeclaredField(name); field.setAccessible(true); return field.get(activity);
    }
    private void set(MainActivity activity, String name, Object value) throws Exception {
        Field field = MainActivity.class.getDeclaredField(name); field.setAccessible(true); field.set(activity, value);
    }
    private ActivityController<OfflineActivity> open() throws Exception {
        ActivityController<OfflineActivity> controller = Robolectric.buildActivity(OfflineActivity.class).setup();
        Thread worker = (Thread)get(controller.get(), "versionThread");
        if (worker != null) worker.join(3000);
        shadowOf(Looper.getMainLooper()).idle();
        assertNotNull(String.valueOf(get(controller.get(), "startupError")), get(controller.get(), "game"));
        return controller;
    }
    @Test public void lateStartupAfterDestroyDoesNotCrash() throws Exception {
        ActivityController<OfflineActivity> controller = open();
        MainActivity activity = controller.get();
        controller.pause().stop().destroy();
        activity.finishStartup(true);
        assertNull(get(activity, "game"));
        assertFalse((Boolean)get(activity, "useBundledAssets"));
    }
    @Test public void rendererLossDoesNotExitAppOrReuseDeadWebView() throws Exception {
        for (boolean crashed : new boolean[]{false,true}) {
            ActivityController<OfflineActivity> controller = open();
            MainActivity activity = controller.get();
            WebView old = (WebView)get(activity, "game");
            WebViewClient client = old.getWebViewClient();
            assertTrue(client.onRenderProcessGone(old, new RenderProcessGoneDetail() {
                @Override public boolean didCrash() { return crashed; }
                @Override public int rendererPriorityAtExit() { return 0; }
            }));
            assertNull(get(activity, "game")); assertNull(old.getParent()); assertFalse(activity.isFinishing());
            assertEquals(View.VISIBLE, ((View)get(activity, "retryButton")).getVisibility());
            String message = (String)get(activity, "lastFailure");
            assertFalse(message.isEmpty());
            client.onPageFinished(old, "https://shapifarm.kietbuithui.chatgpt.site/");
            assertEquals(View.VISIBLE, ((View)get(activity, "loading")).getVisibility());
            controller.pause().stop().destroy();
        }
    }
    @Test public void authenticationAndRangeRequestsDoNotUseBundledAssets() throws Exception {
        ActivityController<OfflineActivity> controller = open(); MainActivity activity = controller.get();
        set(activity, "useBundledAssets", true);
        WebView web = (WebView)get(activity, "game"); WebViewClient client = web.getWebViewClient();
        assertNull(client.shouldInterceptRequest(web, request("https://auth.openai.com/authorize", Collections.emptyMap())));
        assertNull(client.shouldInterceptRequest(web, request("https://shapifarm.kietbuithui.chatgpt.site/signin-with-chatgpt?return_to=%2F", Collections.emptyMap())));
        assertNull(client.shouldInterceptRequest(web, request("https://shapifarm.kietbuithui.chatgpt.site/assets/music.mp3", Collections.singletonMap("range","bytes=0-10"))));
        assertTrue(MainActivity.isSignInPage("https://shapifarm.kietbuithui.chatgpt.site/signin-with-chatgpt?return_to=%2F"));
        assertFalse(MainActivity.isSignInPage("https://shapifarm.kietbuithui.chatgpt.site/"));
        assertFalse(web.getSettings().getAllowFileAccess());
        controller.pause().stop().destroy();
    }
    @Test public void recreationRestoresNavigationInsteadOfDroppingLogin() throws Exception {
        ActivityController<OfflineActivity> controller = open(); MainActivity activity = controller.get();
        WebView web = (WebView)get(activity,"game");
        web.loadUrl("https://shapifarm.kietbuithui.chatgpt.site/signin-with-chatgpt?return_to=%2F");
        // Robolectric does not commit loadUrl to history until explicitly requested.
        shadowOf(web).pushEntryToHistory("https://shapifarm.kietbuithui.chatgpt.site/signin-with-chatgpt?return_to=%2F");
        Bundle state = new Bundle(); controller.saveInstanceState(state);
        assertNotNull(state.getBundle("webState"));
        controller.pause().stop().destroy();
        ActivityController<OfflineActivity> restored = Robolectric.buildActivity(OfflineActivity.class).create(state).start().restoreInstanceState(state).resume().visible();
        Thread worker=(Thread)get(restored.get(),"versionThread");if(worker!=null)worker.join(3000);
        shadowOf(Looper.getMainLooper()).idle();
        WebView next=(WebView)get(restored.get(),"game");assertNotSame(web,next);
        assertEquals("https://shapifarm.kietbuithui.chatgpt.site/signin-with-chatgpt?return_to=%2F",next.getUrl());
        restored.pause().stop().destroy();
    }
    private WebResourceRequest request(String url, Map<String,String> headers) {
        return new WebResourceRequest() {
            public Uri getUrl(){return Uri.parse(url);} public boolean isForMainFrame(){return true;}
            public boolean isRedirect(){return false;} public boolean hasGesture(){return true;}
            public String getMethod(){return "GET";} public Map<String,String> getRequestHeaders(){return headers;}
        };
    }
}
