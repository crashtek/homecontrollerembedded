import Schedule from './Schedule';
import logger from './logger';

const getNextSchedule = (room) => {
  let nextSchedule = null;
  let nextTime = null;
  room.schedules.forEach((rawSchedule) => {
    const schedule = new Schedule(room.ipaddress, rawSchedule);
    const scheduleNextTime = schedule.nextTime();

    if (nextTime === null || nextTime > scheduleNextTime) {
      nextTime = scheduleNextTime;
      nextSchedule = schedule;
    }
  });

  return nextSchedule;
};

export class ScheduleClock {
  constructor(rooms) {
    this.rooms = rooms;
    this.timer = null;
    this.lastDelay = 500;
    this.maxDelay = 30000;
    this.nextTime = null;
    this.currentSchedules = null;
    this.update();
  }

  setRooms(rooms) {
    this.rooms = rooms;
    this.update();
  }

  update() {
    // clear any old timer
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
      this.nextTime = null;
    }

    const rooms = this.rooms;
    let nextTime = null;
    this.nextSchedules = [];
    rooms.forEach((room) => {
      const schedule = getNextSchedule(room);
      const roomNextTime = schedule.nextTime();
      if (nextTime === null || roomNextTime < nextTime) nextTime = roomNextTime;
      if (roomNextTime === nextTime) this.nextSchedules.push(schedule);
    });

    if (!nextTime) {
      logger.info('No schedules found, doing nothing...');
      return;
    } // end early if there are no schedules

    const milliSecondsToWait = nextTime - Date.now();
    logger.info(`Scheduling next command: waiting ${milliSecondsToWait} milliSeconds for ${nextTime}`);
    this.nextTime = nextTime;
    this.timer = setTimeout(this.execute.bind(this), milliSecondsToWait);
  }

  async execute() {
    const schedules = this.currentSchedules || this.nextSchedules;
    let allPassed = true;
    while (allPassed && schedules.length > 0) {
      const nextSchedule = schedules.shift();
      const succeeded = await nextSchedule.exec();
      if (!succeeded) {
        // schedule failed, copy back in and set current schedules, then rest and try again
        if (this.lastDelay < this.maxDelay) this.lastDelay = this.lastDelay * 2;
        if (!this.currentSchedules || (this.lastDelay + Date.now()) < this.nextTime) {
          // Still have time before the next schedule fires
          this.currentSchedules = this.nextSchedules;
          this.currentSchedules.unshift(nextSchedule);
          allPassed = false;
          logger.info(`error executing schedule, waiting ${this.lastDelay} millisecond(s) before trying again...`);
          setTimeout(this.execute.bind(this), this.lastDelay);
        } else {
          // next schedule is due, just kill this list of schedules
          logger.info('Schedules failed, but next schedule is too soon, so giving up');
          this.currentSchedules = null;
        }
      } else {
        this.lastDelay = 500;
      }
    }
    this.update();
    if (allPassed) this.currentSchedules = null;
  }
}

export default ScheduleClock;
