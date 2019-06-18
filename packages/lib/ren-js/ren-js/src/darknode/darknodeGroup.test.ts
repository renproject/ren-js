import { DarknodeGroup, lightnodes } from "./darknodeGroup";

test("bootstrapping", async () => {
    // try {
    //     console.log(await (new Darknode(bootstrapNode0).getHealth()));
    // } catch (error) {
    //     console.log(error);
    // }
    const group: DarknodeGroup = new DarknodeGroup(lightnodes);
    expect(group.darknodes.size).toBeGreaterThan(1);
});
