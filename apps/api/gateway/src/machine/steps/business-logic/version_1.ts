import { assign, setup, forwardTo } from 'xstate';

type Event = { type: 'REGISTER'; payload: { name: string } };
type Context = { name: string };
type State = { value: 'registered' | 'unregistered'; context: Context };

export const initialContext: Context = { name: '' };

const machine = setup({
  types: {
    context: {} as Context,
    events: {} as Event,
  }
}).createMachine({
  id: 'register',
  initial: 'unregistered',
  context: {
    name: '',
  },
  states: {
    unregistered: {
      on: {
        REGISTER: {
          target: 'registered',
          actions: assign({ name: ({ event }: { event: Extract<Event, { type: 'REGISTER' }> }) => event.payload.name }),
        },
      },
    },
    registered: {
      type: 'final',
      output: ({ context }: { context: Context }) => ({ name: context.name }),
    },
  },
});

export const registrationMachine = {
  machine,
};

const api = {
  register: (name: string) => {
    return {
      type: 'REGISTER',
      payload: { name },
    } as Event;
  },
};

export const registrationApi = api;