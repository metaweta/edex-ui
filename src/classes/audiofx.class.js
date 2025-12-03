class AudioManager {
    constructor() {
        // Howler is loaded globally via window.Howl/window.Howler
        const {Howl, Howler} = window;
        // Use nodeAPI.joinSync for path operations
        const audioPath = (file) => window.nodeAPI.joinSync(__dirname, "assets", "audio", file);

        if (window.settings.audio === true) {
            if(window.settings.disableFeedbackAudio === false) {
                this.stdout = new Howl({
                    src: [audioPath("stdout.wav")],
                    volume: 0.4
                });
                this.stdin = new Howl({
                    src: [audioPath("stdin.wav")],
                    volume: 0.4
                });
                this.folder = new Howl({
                    src: [audioPath("folder.wav")]
                });
                this.granted = new Howl({
                    src: [audioPath("granted.wav")]
                });
            }
            this.keyboard = new Howl({
                src: [audioPath("keyboard.wav")]
            });
            this.theme = new Howl({
                src: [audioPath("theme.wav")]
            });
            this.expand = new Howl({
                src: [audioPath("expand.wav")]
            });
            this.panels = new Howl({
                src: [audioPath("panels.wav")]
            });
            this.scan = new Howl({
                src: [audioPath("scan.wav")]
            });
            this.denied = new Howl({
                src: [audioPath("denied.wav")]
            });
            this.info = new Howl({
                src: [audioPath("info.wav")]
            });
            this.alarm = new Howl({
                src: [audioPath("alarm.wav")]
            });
            this.error = new Howl({
                src: [audioPath("error.wav")]
            });

            Howler.volume(window.settings.audioVolume);
        } else {
            Howler.volume(0.0);
        }

        // Return a proxy to avoid errors if sounds aren't loaded
        return new Proxy(this, {
            get: (target, sound) => {
                if (sound in target) {
                    return target[sound];
                } else {
                    return {
                        play: () => {return true;}
                    }
                }
            }
        });
    }
}

module.exports = {
    AudioManager
};
