// Display geometry is approximate; these routes encode the user-confirmed circulation relationship.
export const BRIDGE_DECK=5.4;
export const BRIDGE_MIN_CLEARANCE=4.6125;
export const TRUCK_HEIGHT=4.16;
export const UNDERBRIDGE_ROAD={minZ:12.4,maxZ:20,centerZ:16.2};
export const VEHICLE_APPROACH=[[-58,16.2],[-43,16.2],[-33,16.2],[-25,16.2],[-21,23],[-12,23],[-2,20],[1.22,20],[1.22,23]];
const stair=[[-34.7,.18,30.65],[-35.2,.18,30.65],[-39.96,2.765,30.65],[-40.88,2.765,29.275],[-39.96,2.765,27.9],[-35.2,5.43,27.9],[-33,5.43,27.9],[-33,5.43,8.4]];
export const PERSON_ENTRY=[[-32.3,.18,43],[-32.3,.18,33.3],[-32.3,.18,32],[-32.3,.18,30.65],[-34.1,.18,30.65],...stair];
export const PERSON_EXIT=[...stair.toReversed(),[-34.55,.18,31.75],[-35.35,.18,31.80],[-34.95,.18,32.2],[-34.85,.18,32.7],[-34.95,.18,33.2],[-35.35,.18,33.65],[-35.35,.18,34.1],[-35.35,.18,39]];
export const BOOTH={frontZ:33.1,stairFrontZ:33.1,frontDoor:[-32.3,33.1],leftDoor:[-34,30.65],exitGate:[-35.35,32.7]};
