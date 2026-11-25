export type ChildExitOption = {
    isWin: boolean;
    stoppedByUser: boolean;
};

/**
 * Decide whether a spawned child process ended successfully.
 *
 * Windows has no exit signals: a process terminated by taskkill reports exit
 * code 1, exactly like an ordinary failure (ffmpeg uses 1 for every error), so
 * exit code 1 only counts as success when this app stopped the process itself.
 * Any other non-zero code stays a failure even after a stop, as before.
 * On POSIX a process killed by a signal reports a null code, which is kept as
 * success to leave the existing behaviour there unchanged.
 */
export const childExitSucceeded = (
    code: number | null,
    option: ChildExitOption,
): boolean => {
    if (0 === code) {
        return true;
    }
    if (null === code) {
        return !option.isWin;
    }
    return option.isWin && 1 === code && option.stoppedByUser;
};
