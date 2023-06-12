import { RecipleCrashHandler } from 'reciple-anticrash';

export default new RecipleCrashHandler(process.env.REPORT_CHANNEL ? [process.env.REPORT_CHANNEL] : []);