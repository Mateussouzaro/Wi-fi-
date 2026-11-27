package com.craquedavarzea.jogo;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.content.pm.ActivityInfo;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

// Hosts the single-file game (assets/index.html) in a full-screen WebView.
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        // lets the game switch between portrait and landscape from its settings
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setOrientation(final String o) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if ("vertical".equals(o)) setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
                        else if ("horizontal".equals(o)) setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                        else setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_FULL_USER);
                    }
                });
            }
        }, "Android");
        setContentView(web);
        hideBars();
        web.loadUrl("file:///android_asset/index.html");
    }

    private void hideBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        web.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.resumeTimers();
        hideBars();
    }

    @Override
    public void onBackPressed() {
        // Back opens the in-game pause menu instead of closing the app.
        web.evaluateJavascript("document.getElementById('pausebtn') && document.getElementById('pausebtn').click()", null);
    }
}
