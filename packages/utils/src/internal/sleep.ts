/**
 * Pauses the thread for the specified number of milliseconds.
 *
 * @param ms The number of milliseconds to pause for.
 */
export const sleep = async (ms: number): Promise<void> => {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
};
sleep.SECONDS = 1000;
sleep.MINUTES = 60 * sleep.SECONDS;
