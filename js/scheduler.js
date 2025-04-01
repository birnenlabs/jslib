import {checkNonUndefined} from './preconditions.js';

// Some time in year 2096
export const EPOCH_FUTURE = 4000000000;

// Base value for exponential backoff.
const RETRY_DELAY_BASE_SEC = 5;

// Maximum value of retry delay
const RETRY_DELAY_MAX_SEC = 900;

/**
 * Base event class
 *
 * This class is not exported, events are created using Event.repeat,
 * Event.once or Event.at static methods.
 *
 * The BaseEvent is used for events that occurs on every tick.
 */
class BaseEvent {
  /** @type {function():any} */
  #fn;

  /** @type {string} */
  #id;

  /**
   * @param {string} id
   * @param {function():any} fn
   */
  constructor(id, fn) {
    this.#fn = fn;
    this.#id = id;
  }

  /**
   * @return {string}
   */
  toString() {
    return `${this.#id}`;
  }

  /**
   * @return {string}
   */
  id() {
    return this.#id;
  }

  /**
   * Performs function
   * @return {Promise<any>}
   */
  tick() {
    // Use `new Promise()` to start promise chain even for non promise functions.
    return new Promise((resolve, reject) => resolve(this.#fn()))
        .catch((e) => {
          // Log and rethrow failed task.
          // Child classes will set the next event run in their finally clauses,
          // Scheduler will reschedule in case of failure
          console.error(`${event} failed`, e);
          throw e;
        });
  }
}

/**
 * Scheduled event class
 *
 * This class is not exported, events are created using Event.repeat,
 * Event.once or Event.at static methods.
 *
 * The ScheduledEvent has next run time to be invoked by the scheduled.
 */
class ScheduledEvent extends BaseEvent {
  /** @type {number} */
  #nextRunEpochSec;

  /** @type {number} */
  #retryDelaySec;

  /** @type {number} */
  #rescheduleCount;

  /**
   * @param {string} id
   * @param {function():any} fn
   * @param {number} nextRunEpochSec
   */
  constructor(id, fn, nextRunEpochSec) {
    super(id, fn);
    this.#nextRunEpochSec = nextRunEpochSec;
    this.#retryDelaySec = RETRY_DELAY_BASE_SEC;
    this.#rescheduleCount = 0;
  }

  /**
   * @return {string}
   */
  toString() {
    // Using sv (Sweden) as it uses iso time format
    return super.toString() + `: scheduled=${this.#nextRunEpochString()}`;
  }

  /**
   * @return {boolean}
   */
  isScheduled() {
    return this.nextRunEpochSec() !== -1;
  }

  /**
   * @return {number}
   */
  nextRunEpochSec() {
    return this.#nextRunEpochSec;
  }

  /**
   * @return {string}
   */
  #nextRunEpochString() {
    return this.isScheduled() ? new Date(this.#nextRunEpochSec * 1000).toLocaleString('sv') : 'never';
  }

  /** Will overwrite #nextRunEpochSec to retry the task in #retryDelaySec seconds or earlier */
  scheduleForRetry() {
    const retryRunEpochSec = getNowSec() + this.#retryDelaySec;
    const originalNextRunEpochString = this.#nextRunEpochString();
    if (this.isScheduled()) {
      // Reschedule scheduled event only when retry is earlier than expected run.
      this.setNextRunEpochSec(Math.min(retryRunEpochSec, this.nextRunEpochSec()));
    } else {
      this.setNextRunEpochSec(retryRunEpochSec);
    }

    // Using 1.659 as multiplier because it produces nice numbers: 5, 8, 13, 22, 36, 60, 100...
    this.#retryDelaySec = Math.min(Math.round(this.#retryDelaySec * 1.659), RETRY_DELAY_MAX_SEC);
    this.#rescheduleCount++;

    console.log(`Rescheduling: ${super.toString()}: retry #${this.#rescheduleCount}, original next run: ${originalNextRunEpochString}, next retry delay sec: ${this.#retryDelaySec}`);
  }

  /**
   * @param {number} nextRunEpochSec
   */
  setNextRunEpochSec(nextRunEpochSec) {
    this.#nextRunEpochSec = nextRunEpochSec;
  }


  /**
   * Performs function
   * @return {Promise<any>}
   */
  tick() {
    return super.tick()
        // Reset retry timer on success
        .then(() => this.#retryDelaySec = RETRY_DELAY_BASE_SEC)
        // Reset reschedule count on success
        .then(() => this.#rescheduleCount = 0)
        // Always set next run (RepeatableEvent will overwrite it in its finally clause)
        .finally(() => this.setNextRunEpochSec(-1));
  }

  /**
   * @param {ScheduledEvent} e1
   * @param {ScheduledEvent} e2
   * @return {number}
   */
  static compare(e1, e2) {
    return (e1.#nextRunEpochSec - e2.#nextRunEpochSec) || e1.id().localeCompare(e2.id());
  }
}

/**
 * Repeatable event class
 *
 * This class is not exported, events are created using Event.repeat,
 * Event.once or Event.at static methods.
 *
 * The RepeatableEvent is a special case of the ScheduledEvent, that will
 * reschedule itself after the completion.
 */
class RepeatableEvent extends ScheduledEvent {
  /** @type {number} */
  #intervalSec;

  /**
   * @param {string} id
   * @param {function():any} fn
   * @param {number} intervalSec
   */
  constructor(id, fn, intervalSec) {
    super(id, fn, RepeatableEvent.#calculateNextRunEpochSec(intervalSec));
    this.#intervalSec = intervalSec;
  }

  /**
   * @return {string}
   */
  toString() {
    return super.toString() + `, repeatable every ${this.#intervalSec/60}m`;
  }

  /**
   * Perform function
   * @return {Promise<any>}
   */
  tick() {
    return super.tick()
        // Always set the next run.
        .finally(() => super.setNextRunEpochSec(RepeatableEvent.#calculateNextRunEpochSec(this.#intervalSec)));
  }

  /**
   * Will return next epoch seconds timestamp when event should be run.
   *
   * @param {number} intervalSec
   * @return {number}
   */
  static #calculateNextRunEpochSec(intervalSec) {
    const offsetSec = new Date().getTimezoneOffset() * 60;
    const nowSec = getNowSec();
    const result = nowSec + intervalSec - ((nowSec - offsetSec) % intervalSec);
    return result;
  }
}

/**
 * Class that runs the specified function periodically.
 *
 * SetTimeout bahaviour depends on implementation - it may happen
 * that it will pause the timer while sleeping (i.e. when setTimout
 * for 1h is set and the computer is paused for 30 minutes the function
 * may be invoked after 90 minutes).
 * This implementation ticks every second and stores the next invocation
 * timestamp.
 */
class Scheduler {
  // when setting script to run every 24 hours it is expected to
  // run at midnight local time - need to adjust epoch to be in
  // local time
  static #tzOffsetSec = new Date().getTimezoneOffset() * 60;

  /** @type {BaseEvent[]} */
  static #everyTickEvents = [];

  /** @type {ScheduledEvent[]} */
  static #scheduledEvents = [
    // Adding last event to guard the end of an array.
    // There will be no need to check array length on #tick.
    new ScheduledEvent('__?# internal Scheduler last event #?__', ()=>{}, EPOCH_FUTURE),
  ];

  static {
    setTimeout(Scheduler.#tick, 1000 - (Date.now() % 1000));
  }

  /**
   * Function invoked every second.
   * @return {Promise<any>}
   */
  static #tick() {
    const nowSec = getNowSec();

    /** @type {ScheduledEvent[]} */
    const eventsToRun = [];

    // Scheduled events are always sorted and at least one element exists.
    while (Scheduler.#scheduledEvents[0].nextRunEpochSec() <= nowSec) {
      eventsToRun.push(checkNonUndefined(Scheduler.#scheduledEvents.shift()));
    }

    let tickEventsPromise =
       // Run #everyTickEvents in parallel
       Promise.all(
           Scheduler.#everyTickEvents
               // Swallow exception here - failed are already logged and #everyTickEvents will be tried at the next tick anyway
               .map((event) => event.tick().catch((e) => {})))
           // Schedule the next tick in 1 second after all the #everyTickEvents completed.
           .then(() => setTimeout(Scheduler.#tick, 1000 - (Date.now() % 1000)));

    // Run the remaining eventsToRun in the sequence
    for (const event of eventsToRun) {
      // Failed non #everyTickEvents should be retried
      tickEventsPromise = tickEventsPromise.then(() => event.tick().catch((e) => event.scheduleForRetry()));
    }

    return tickEventsPromise
        // Maybe re-add functions from eventsToRun (including events scheduled for retry).
        .then(() => eventsToRun.forEach((event) => event.isScheduled() && Scheduler.add(event)))
        .catch((e) => console.error(`Unexpected exception in scheduler - this is a bug.`, e));
  }

  /**
   * @param {BaseEvent|ScheduledEvent|RepeatableEvent} event
   */
  static add(event) {
    const findSameIdFn = (e) => e.id() === event.id();

    // RepeatableEvent is ScheduledEvent
    if (event instanceof ScheduledEvent) {
      if (!event.isScheduled()) {
        console.error(`Scheduler: cannot add non scheduled event: ${event}`);
      }

      // Check if event with the same id exists in the scheduler array.
      const index = Scheduler.#scheduledEvents.findIndex(findSameIdFn);
      if (index == -1) {
        console.log(`Scheduler add: ${event}`);
        Scheduler.#scheduledEvents.push(event);
      } else {
        console.log(`Scheduler replace: ${Scheduler.#scheduledEvents[index]} with ${event}`);
        Scheduler.#scheduledEvents[index] = event;
      }
      Scheduler.#scheduledEvents.sort(ScheduledEvent.compare);
    } else if (event instanceof BaseEvent) {
      // Check if event with the same id exists in the every second events array.
      const index = Scheduler.#everyTickEvents.findIndex(findSameIdFn);
      if (index == -1) {
        console.log(`Scheduler add: ${event}, repeatable every 1s`);
        Scheduler.#everyTickEvents.push(event);
      } else {
        console.log(`Scheduler replace: ${Scheduler.#everyTickEvents[index]} with ${event}, repeatable every 1s`);
        Scheduler.#everyTickEvents[index] = event;
      }
    } else {
      console.error(`Scheduler: Invalid event: ${event}`);
    }
  }
}


/** Exported class used to hold static constructors of events */
export class Event {
  /**
   * Repetable events will be called every ${min} minutes or
   * every second when minute not set.
   *
   * @param {string} id
   * @param {function():any} fn
   * @param {number} min
   */
  static repeat(id, fn, min = 0) {
    if (min < 0) {
      throw new Error(`Negative min value: ${min}.`);
    } else if (min === 0) {
      Scheduler.add(new BaseEvent(id, fn));
    } else {
      Scheduler.add(new RepeatableEvent(id, fn, min * 60));
    }
  }

  /**
   * @param {string} id
   * @param {function():any} fn
   * @param {number} min
   * @param {number} sec
   */
  static once(id, fn, min = 0, sec = 0) {
    Scheduler.add(new ScheduledEvent(id, fn, getNowSec() + min * 60 + sec));
  }

  /**
   * @param {string} id
   * @param {function():any} fn
   * @param {number} timestampSec
   */
  static at(id, fn, timestampSec) {
    Scheduler.add(new ScheduledEvent(id, fn, timestampSec));
  }
}

/**
 * @return {number}
 */
export function getNowSec() {
  return Math.floor(Date.now() / 1000);
}

/**
 * @param {Date} date
 * @return {number}
 */
export function dateToSec(date) {
  return Math.floor(date.getTime() / 1000);
}

/**
 * @param {number} sec
 * @return {Date}
 */
export function secToDate(sec) {
  return new Date(sec * 1000);
}
