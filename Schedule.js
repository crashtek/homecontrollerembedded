import { commandWindow } from './utils';

const getNextDoW = (lastDoW) => {
  let nextDoW = lastDoW + 1;
  if (nextDoW > 6) return 0;
  return nextDoW;
};

export class Schedule {
  constructor(ipaddress, data) {
    this.ipaddress = ipaddress;
    this.data = data;
  }

  validDay(doW) {
    if (this.data.startDoW <= this.data.endDoW) return doW >= this.data.startDoW && doW <= this.data.endDoW;
    return doW <= this.data.startDoW || doW >= this.data.endDoW;
  }

  nextTime() {
    const nowDate = new Date();
    let nextDoW = nowDate.getDay();
    let days = 0;
    let nextTime = null;
    while (nextTime === null || nextTime <= Date.now()) {
      while (!this.validDay(nextDoW)) {
        nextDoW = getNextDoW(nextDoW);
        days += 1;
      }

      // We match this schedule
      nextTime = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + days,
        this.data.hour, this.data.minute).getTime();
      nextDoW = getNextDoW(nextDoW);
      days += 1;
    }

    return nextTime;
  };

  async exec() {
    return await commandWindow(this.ipaddress, this.data.command);
  }
}

export default Schedule;



