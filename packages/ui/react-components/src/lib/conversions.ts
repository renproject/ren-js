import moment from "moment";

export const alreadyPast = (expiry: number) => {
    return moment.unix(expiry).isBefore(moment.now());
};

/**
 * Converts a timestamp to the number of hours, minutes or seconds from now,
 * showing "Expired" if the timestamp has already passed.
 *
 * @param expiry the time to countdown to as a unix timestamp in seconds
 * @returns a JSX span element with the time remaining and a unit
 */
export const naturalTime = (
    expiry: number,
    options: {
        message: string;
        suffix?: string;
        prefix?: string;
        countDown: boolean;
        showingSeconds?: boolean;
        abbreviate?: boolean;
    },
): string => {
    let diff;
    if (!options.countDown) {
        diff = moment.duration(moment().diff(moment.unix(expiry)));
    } else {
        diff = moment.duration(moment.unix(expiry).diff(moment()));
    }
    let days = diff.asDays();
    let hours = diff.asHours();
    let minutes = diff.asMinutes();
    let seconds = diff.asSeconds();

    const suffix = options.suffix ? ` ${options.suffix}` : "";
    const prefix = options.prefix ? `${options.prefix} ` : "";

    if (days > 2) {
        days = Math.round(days);
        return `${prefix}${days} ${days === 1 ? "day" : "days"}${suffix}`;
    }
    if (hours >= 1) {
        // Round to the closest hour
        hours = Math.round(hours);
        return `${prefix}${hours} ${hours === 1 ? "hour" : "hours"}${suffix}`;
    } else if (minutes >= 1) {
        minutes = Math.round(minutes);
        if (options.abbreviate) {
            return `${prefix}${minutes} ${
                minutes === 1 ? "min" : "mins"
            }${suffix}`;
        }
        return `${prefix}${minutes} ${
            minutes === 1 ? "minute" : "minutes"
        }${suffix}`;
    } else if (options.showingSeconds && seconds >= 1) {
        seconds = Math.floor(seconds);
        if (options.abbreviate) {
            return `${prefix}${seconds} ${
                seconds === 1 ? "sec" : "secs"
            }${suffix}`;
        }
        return `${prefix}${seconds} ${
            seconds === 1 ? "second" : "seconds"
        }${suffix}`;
    } else {
        return `${options.message}`;
    }
};

// Sleep for specified number of milliseconds
export const sleep = async (ms: number) =>
    // tslint:disable-next-line: no-string-based-set-timeout
    new Promise((resolve) => setTimeout(resolve, ms));

export const second = 1000;

export enum TimeMagnitude {
    Second = 1 * second,
    Minute = 60 * second,
    Hour = 3600 * second,
    Day = 86400 * second,
}

// Returns the the time units in which a time will be represented in by naturalTime
export const getTimeMagnitude = (
    expiry: number,
    showingSeconds = false,
): TimeMagnitude => {
    let diff;
    if (moment.unix(expiry).isBefore(moment())) {
        diff = moment.duration(moment().diff(moment.unix(expiry)));
    } else {
        diff = moment.duration(moment.unix(expiry).diff(moment()));
    }
    const days = diff.asDays();
    const hours = diff.asHours();
    const minutes = diff.asMinutes();

    if (days > 2) {
        return TimeMagnitude.Day;
    }
    if (hours >= 1) {
        return TimeMagnitude.Hour;
    } else if (minutes >= 1 || !showingSeconds) {
        return TimeMagnitude.Minute;
    } else {
        return TimeMagnitude.Second;
    }
};
