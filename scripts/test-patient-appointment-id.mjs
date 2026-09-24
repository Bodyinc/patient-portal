import assert from "node:assert/strict";
import { appointmentIdToReopen, visitIdToOpen } from "../src/lib/consultations/appointment-id.ts";

const firstPlan = "sub-first";
const secondPlan = "sub-second";

const afterFirstStart = [
  { subscriptionId: firstPlan, appointmentId: "appt-first" },
];

const reopened = appointmentIdToReopen(afterFirstStart, firstPlan);
assert.equal(reopened, "appt-first", "closing the tab and opening again must return the first id");

const secondOpen = appointmentIdToReopen(afterFirstStart, firstPlan);
assert.equal(secondOpen, "appt-first", "another open still returns appt-first");

assert.equal(
  appointmentIdToReopen([], secondPlan),
  null,
  "a plan with nothing saved is the only case that may create a new id",
);

const twoPlans = [
  { subscriptionId: firstPlan, appointmentId: "appt-first" },
  { subscriptionId: secondPlan, appointmentId: "appt-second" },
];
assert.equal(appointmentIdToReopen(twoPlans, firstPlan), "appt-first");
assert.equal(appointmentIdToReopen(twoPlans, secondPlan), "appt-second");

const stillOnForm = visitIdToOpen({
  storedId: "appt-form",
  openAppointments: [{ id: "appt-form", hasDialog: false }],
});
assert.equal(stillOnForm, "appt-form", "before the form is submitted, reopen stays on the form id");

const afterSubmit = visitIdToOpen({
  storedId: "appt-form",
  openAppointments: [
    { id: "appt-form", hasDialog: false },
    { id: "appt-room", hasDialog: true },
  ],
});
assert.equal(afterSubmit, "appt-room", "after submit, reopen must open the room id");

const savedRoom = visitIdToOpen({
  storedId: "appt-room",
  openAppointments: [{ id: "appt-room", hasDialog: true }],
});
assert.equal(savedRoom, "appt-room", "once the room id is saved, reopen keeps it");

console.log("patient reopen: form id until submit, then the room id, then that same room id");
