/** Open the getting-started guide or start the tour from anywhere in the office app (one Onboarding per page). */
export const OPEN_GUIDE = "builderos:open-guide";
export const START_TOUR = "builderos:start-tour";

export const openGuide = () => window.dispatchEvent(new Event(OPEN_GUIDE));
export const startTour = () => window.dispatchEvent(new Event(START_TOUR));
