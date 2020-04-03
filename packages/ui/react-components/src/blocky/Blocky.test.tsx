export const name = "Blocky.test";

// /* tslint:disable */

// import test from "ava";
// import * as React from "react";
// import { spy } from "sinon";
// import Enzyme, { mount } from "enzyme";
// import Adapter from "enzyme-adapter-react-16";
// import { Blocky } from "./Blocky";

// Enzyme.configure({ adapter: new Adapter() });

// const mouseMove = (x: number, y: number) => {
//   const event = document.createEvent("MouseEvents");
//   event.initMouseEvent("mousemove", true, true, window, 0, 0, 0, x, y, false, false, false, false, 0, null);
//   document.dispatchEvent(event);
//   return event;
// };

// test.beforeEach(async _t => {
//   const div = document.createElement("div");
//   document.body.appendChild(div);
// });

// test("should mount without error", async t => {
//   const blocky = mount(<Blocky address="0x" />);
//   t.truthy(!!blocky);
// });

// test("should call onDrag when dragging", async t => {
//   const onDrag = spy();
//   const blocky = mount(<Blocky address="0x" />);
//   blocky
//     .find("div")
//     .at(0)
//     .simulate("mousedown", { clientX: 0, clientY: 0 });
//   mouseMove(200, 220);
//   t.is(onDrag.callCount, 0);
// });
