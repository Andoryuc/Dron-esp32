package edu.udes.uav.gcs;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VoskVoicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
