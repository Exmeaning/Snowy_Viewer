import { CHAR_NAMES } from "@/types/types";

// Character ID to [Month, Day] mapping
export const BIRTHDAY_MAP: Record<number, [number, number]> = {
    3: [10, 27],
    25: [11, 5],
    11: [11, 12],
    8: [12, 6],
    22: [12, 27],
    23: [12, 27],
    4: [1, 8],
    18: [1, 27],
    24: [1, 30],
    17: [2, 10],
    26: [2, 17],
    9: [3, 2],
    7: [3, 19],
    5: [4, 14],
    19: [4, 30],
    2: [5, 9],
    13: [5, 17],
    12: [5, 25],
    16: [6, 24],
    15: [7, 20],
    10: [7, 26],
    1: [8, 11],
    20: [8, 27],
    21: [8, 31],
    14: [9, 9],
    6: [10, 5],
};

export interface UpcomingBirthday {
    id: number;
    name: string;
    date: Date; // The actual date of the next birthday (year is current or next year)
    month: number;
    day: number;
    isToday: boolean;
}

/**
 * Check if the character is a Virtual Singer (ID 21-26)
 */
export function isVirtualSinger(id: number): boolean {
    return id >= 21 && id <= 26;
}

/**
 * Get birthdays within the next 3 months
 */
// --- DEBUG SETTINGS ---
// Set this to a specific date string (YYYY-MM-DD) to test birthday display.
// Set to null to use current date.
// Example: "2024-08-31" (Miku Anniversary), "2024-02-17" (KAITO Birthday)
const DEBUG_DATE: string | null = null;
// ----------------------

export function getUpcomingBirthdays(): UpcomingBirthday[] {
    let today = new Date();

    // Debug override
    if (DEBUG_DATE) {
        today = new Date(DEBUG_DATE);
    }

    today.setHours(0, 0, 0, 0);

    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(today.getMonth() + 3);

    const upcoming: UpcomingBirthday[] = [];

    for (const [idStr, [month, day]] of Object.entries(BIRTHDAY_MAP)) {
        const id = parseInt(idStr);
        // JS month is 0-indexed, but input data is 1-indexed
        const birthdayMonth = month - 1;

        // Calculate next birthday date
        let nextBirthday = new Date(today.getFullYear(), birthdayMonth, day);

        // If birthday has passed this year, it's next year
        if (nextBirthday < today) {
            nextBirthday = new Date(today.getFullYear() + 1, birthdayMonth, day);
        }

        // Check if within 3 months (inclusive of today)
        if (nextBirthday <= threeMonthsLater) {
            upcoming.push({
                id,
                name: CHAR_NAMES[id] || `Character ${id}`,
                date: nextBirthday,
                month,
                day,
                isToday: nextBirthday.getTime() === today.getTime()
            });
        }
    }

    // Sort by date (nearest first)
    return upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get characters whose birthday is today
 */
export function getTodayBirthdays(): UpcomingBirthday[] {
    return getUpcomingBirthdays().filter(b => b.isToday);
}
