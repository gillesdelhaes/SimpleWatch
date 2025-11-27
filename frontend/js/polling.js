/**
 * Polling utilities for dashboard updates.
 */

class Poller {
    constructor(callback, interval = 10000) {
        this.callback = callback;
        this.interval = interval;
        this.timerId = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.callback();

        this.timerId = setInterval(() => {
            this.callback();
        }, this.interval);
    }

    stop() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
        this.isRunning = false;
    }

    restart() {
        this.stop();
        this.start();
    }
}
