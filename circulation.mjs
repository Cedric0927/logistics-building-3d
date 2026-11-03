// Display geometry is approximate; these routes encode the user-confirmed circulation relationship.
export const BRIDGE_DECK=5.4;
export const BRIDGE_MIN_CLEARANCE=4.6125;
export const TRUCK_HEIGHT=4.16;
export const UNDERBRIDGE_ROAD={minZ:12.4,maxZ:20,centerZ:16.2};
export const VEHICLE_APPROACH=[[-58,16.2],[-43,16.2],[-33,16.2],[-25,16.2],[-21,23],[-12,23],[-2,20],[1.22,20],[1.22,23]];
const stair=[[-41,.18,29.8],[-41,2.765,24.24],[-39.62,2.765,23.5],[-38.25,2.765,24.24],[-38.25,5.43,29],[-35.1,5.43,30.25],[-33,5.43,29],[-33,5.43,8.4]];
export const PERSON_ENTRY=[[-32.3,.18,43],[-32.3,.18,33.3],[-32.3,.18,32.0],[-33.1,.18,30.65],[-34.1,.18,30.65],[-38.0,.18,30.65],...stair];
export const PERSON_EXIT=[...stair.toReversed(),[-40,.18,30.2],[-35.35,.18,30.2],[-35.35,.18,31.1],[-34.95,.18,31.5],[-34.85,.18,32],[-34.95,.18,32.5],[-35.35,.18,32.95],[-35.35,.18,33.5],[-35.35,.18,39]];
export const BOOTH={frontZ:33.1,stairFrontZ:33.1,frontDoor:[-32.3,33.1],leftDoor:[-34,30.65],exitGate:[-35.35,32]};
