// MaxRects algorithm for packing rectangles into sheets.
//
// Workshop Tools phase — the sheet-packing engine behind the "Mesh Sheet
// Optimiser" tool (see src/tools/NativeCalculators.js). Ported verbatim
// from the source application this phase's calculators came from: a
// generic, self-contained bin-packing algorithm with no DOM or UI
// dependency of its own, so nothing about it needed to change to become
// a Workshop tool — only the calculator that calls it, and the interface
// around that, are new. See docs/TOOLS.md for the full account.


// Rectangle - Represents every free space.
class Rectangle {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    area() {
        return this.w * this.h;
    }

    contains(other) {
        return (
            other.x >= this.x &&
            other.y >= this.y &&
            other.x + other.w <= this.x + this.w &&
            other.y + other.h <= this.y + this.h
        );
    }

    intersects(other) {
        return !(
            other.x >= this.x + this.w ||
            other.x + other.w <= this.x ||
            other.y >= this.y + this.h ||
            other.y + other.h <= this.y
        );
    }

    equals(other) {
        return (
            this.x === other.x &&
            this.y === other.y &&
            this.w === other.w &&
            this.h === other.h
        );
    }
}

// Piece
export class Piece {
    constructor(width,height,label){
        this.w = width;
        this.h = height;
        this.label = label;

        this.area = width * height;
    }
}

// Placement, Once a piece has been packed it becomes a placement.
class Placement{
    constructor(x,y,w,h,label){
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.label = label;
    }
}

// Sheet
class Sheet{
    constructor(width,height){
        this.width = width;
        this.height = height;

        this.freeRects = [
            new Rectangle(0,0,width,height)
        ];

        this.items = [];
    }
}

// Find the best position for a piece in the sheet.
// Find the best position for a piece in the sheet.
function findBestPosition(sheet, piece) {
    let best = null;
    let bestShortFit = Infinity;
    let bestLongFit = Infinity;
    let bestRemainingArea = Infinity;
    let bestRectArea = Infinity;

    for (let i = 0; i < sheet.freeRects.length; i++) {
        const rect = sheet.freeRects[i];
        const rectArea = rect.area();

        const orientations = [
            { w: piece.w, h: piece.h, rotated: false },
            { w: piece.h, h: piece.w, rotated: true }
        ];

        for (const option of orientations) {
            // Doesn't fit
            if (option.w > rect.w || option.h > rect.h)
                continue;

            const leftoverHoriz = rect.w - option.w;
            const leftoverVert = rect.h - option.h;
            const shortFit = Math.min(leftoverHoriz, leftoverVert);
            const longFit = Math.max(leftoverHoriz, leftoverVert);

            const remainingArea =
                rectArea - (option.w * option.h);

            const better = (
                shortFit < bestShortFit ||
                (
                    shortFit === bestShortFit &&
                    longFit < bestLongFit
                ) ||
                (
                    shortFit === bestShortFit &&
                    longFit === bestLongFit &&
                    remainingArea < bestRemainingArea
                ) ||
                (
                    shortFit === bestShortFit &&
                    longFit === bestLongFit &&
                    remainingArea === bestRemainingArea &&
                    rectArea < bestRectArea
                )
            );

            if (!better)
                continue;
            bestShortFit = shortFit;
            bestLongFit = longFit;
            bestRemainingArea = remainingArea;
            bestRectArea = rectArea;

            best = {
                rectIndex: i,

                x: rect.x,
                y: rect.y,

                w: option.w,
                h: option.h,

                rotated: option.rotated,

                shortFit,
                longFit,
                remainingArea
            };
        }
    }
    return best;
}

// Split the free rectangles after placing a piece.
// Uses a guillotine split chosen to preserve the largest usable offcuts.
function splitFreeRectangles(sheet, placed) {
    const updated = [];

    for (const rect of sheet.freeRects) {
        // No intersection, keep rectangle unchanged.
        if (!rect.intersects(placed)) {
            updated.push(rect);
            continue;
        }

        // Space remaining on each side
        const rightWidth  = rect.x + rect.w - (placed.x + placed.w);
        const bottomHeight = rect.y + rect.h - (placed.y + placed.h);

        // --------------------------------------------------
        // Decide which direction to split.
        //
        // We preserve the larger remaining strip.
        // --------------------------------------------------

        if (rightWidth >= bottomHeight) {

            // Vertical-first split
            if (rightWidth > 0) {
                updated.push(
                    new Rectangle(
                        placed.x + placed.w,
                        rect.y,
                        rightWidth,
                        rect.h
                    )
                );
            }
            if (bottomHeight > 0) {
                updated.push(
                    new Rectangle(
                        rect.x,
                        placed.y + placed.h,
                        placed.x + placed.w - rect.x,
                        bottomHeight
                    )
                );
            }
        }
        else {
            // Horizontal-first split
            if (bottomHeight > 0) {
                updated.push(
                    new Rectangle(
                        rect.x,
                        placed.y + placed.h,
                        rect.w,
                        bottomHeight
                    )
                );
            }
            if (rightWidth > 0) {
                updated.push(
                    new Rectangle(
                        placed.x + placed.w,
                        rect.y,
                        rightWidth,
                        placed.y + placed.h - rect.y
                    )
                );
            }
        }
    }
    sheet.freeRects = updated;
}

// Remove redundant free rectangles from the sheet.
function pruneFreeRectangles(sheet) {
    const pruned = [];
    for (let i = 0; i < sheet.freeRects.length; i++) {
        const a = sheet.freeRects[i];

        // Ignore zero-sized rectangles
        if (a.w <= 0 || a.h <= 0)
            continue;

        let contained = false;

        for (let j = 0; j < sheet.freeRects.length; j++) {
            if (i === j)
                continue;

            const b = sheet.freeRects[j];
            // If rectangle A is completely inside rectangle B,
            // A is redundant.
            if (b.contains(a)) {
                contained = true;
                break;
            }
        }

        if (!contained) {
            // Avoid duplicates
            const duplicate = pruned.some(r => r.equals(a));
            if (!duplicate)
                pruned.push(a);
        }
    }
    sheet.freeRects = pruned;
}

// Place a piece in the sheet.
function placePiece(sheet, piece, placement) {

    if (!placement)
        return null;

    const placed = new Placement(
        placement.x,
        placement.y,
        placement.w,
        placement.h,
        piece.label
    );

    sheet.items.push(placed);
    splitFreeRectangles(sheet, placed);
    pruneFreeRectangles(sheet);

    return placed;
}

// Choose the best sheet size for a given piece and remaining pieces.
function chooseBestSheetSize(piece, remainingPieces, sheetSizes) {
    let bestSheet = null;
    let bestScore = -1;
    let bestArea = Infinity;

    for (const size of sheetSizes) {
        // Create a fresh simulation sheet
        const testSheet = new Sheet(
            size.w,
            size.h
        );
        // Can the current piece even fit?
        const firstPlacement = findBestPosition(
            testSheet,
            piece
        );

        if (!firstPlacement)
            continue;

        placePiece(
            testSheet,
            piece,
            firstPlacement
        );

        let score = 1;

        // Largest remaining pieces first
        const sortedRemaining =
            remainingPieces
                .slice()
                .sort((a, b) => b.area - a.area);

        for (const other of sortedRemaining) {
            const placement =
                findBestPosition(
                    testSheet,
                    other
                );

            if (!placement)
                continue;

            placePiece(
                testSheet,
                other,
                placement
            );
            score++;
        }

        // Higher score wins
        // Smaller sheet breaks ties

        if (
            score > bestScore ||
            (
                score === bestScore &&
                size.w * size.h < bestArea
            )
        ) {

            bestScore = score;
            bestArea = size.w * size.h;
            bestSheet = size;

        }
    }
    return bestSheet;
}

// Pack pieces into sheets using the MaxRects algorithm.
export function packPieces(pieces, sheetSizes) {
    // Largest pieces first
    pieces.sort((a, b) => {
        if (b.area !== a.area)
            return b.area - a.area;
        if (b.h !== a.h)
            return b.h - a.h;
        return b.w - a.w;
    });

    const sheets = [];

    for (const piece of pieces) {
        let bestSheet = null;
        let bestPlacement = null;
        let bestShortFit = Infinity;
        let bestLongFit = Infinity;

        // --------------------------------------------------
        // Try every existing sheet
        // --------------------------------------------------

        for (const sheet of sheets) {
            const placement = findBestPosition(sheet, piece);

            if (!placement)
                continue;
            if (
                placement.shortFit < bestShortFit ||
                (
                    placement.shortFit === bestShortFit &&
                    placement.longFit < bestLongFit
                )
            ) {
                bestShortFit = placement.shortFit;
                bestLongFit = placement.longFit;

                bestSheet = sheet;
                bestPlacement = placement;
            }
        }

        // --------------------------------------------------
        // Fits an existing sheet
        // --------------------------------------------------

        if (bestSheet) {
            placePiece(
                bestSheet,
                piece,
                bestPlacement
            );
            continue;
        }

        // --------------------------------------------------
        // Need a new sheet
        // --------------------------------------------------

        const remainingPieces =
            pieces.slice(
                pieces.indexOf(piece) + 1
            );

        const chosenSize =
            chooseBestSheetSize(
                piece,
                remainingPieces,
                sheetSizes
            );

        if (!chosenSize)
            throw new Error(
                `Piece ${piece.label} will not fit any stock sheet.`
            );

        const newSheet = new Sheet(
            chosenSize.w,
            chosenSize.h
        );

        const placement = findBestPosition(
            newSheet,
            piece
        );

        placePiece(
            newSheet,
            piece,
            placement
        );

        sheets.push(newSheet);
    }
    return sheets;
}