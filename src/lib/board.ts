import { useCallback, useEffect, useMemo, useState } from 'react';
import { EPS, formatExpr, makeOpNode, num, type ExprNode, type Op } from './solver';

export interface Tile {
  id: number;
  expr: ExprNode;
}

export interface Slot {
  id: number;
  tile: Tile | null;
}

function makeSlots(numbers: number[]): Slot[] {
  return numbers.map((n, i) => ({ id: i + 1, tile: { id: i + 1, expr: num(n) } }));
}

export function useBoard(numbers: number[], integerOnly: boolean) {
  const [slots, setSlots] = useState<Slot[]>(() => makeSlots(numbers));
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op | null>(null);
  const [undoStack, setUndoStack] = useState<Slot[][]>([]);
  const [redoStack, setRedoStack] = useState<Slot[][]>([]);
  const [nextId, setNextId] = useState(numbers.length + 1);
  const [flash, setFlash] = useState(0);

  const key = numbers.join(',');
  useEffect(() => {
    setSlots(makeSlots(numbers));
    setSelectedSlot(null);
    setPendingOp(null);
    setUndoStack([]);
    setRedoStack([]);
    setNextId(numbers.length + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const tiles = useMemo(() => slots.flatMap((s) => (s.tile ? [s.tile] : [])), [slots]);
  const selected =
    selectedSlot !== null ? slots.find((s) => s.id === selectedSlot)?.tile ?? null : null;

  const tapNumber = useCallback(
    (slotId: number) => {
      const slot = slots.find((s) => s.id === slotId);
      if (!slot?.tile) return;
      if (selectedSlot === null) {
        setSelectedSlot(slotId);
        return;
      }
      if (slotId === selectedSlot) {
        setSelectedSlot(null);
        setPendingOp(null);
        return;
      }
      if (!pendingOp) {
        setSelectedSlot(slotId);
        return;
      }
      const a = slots.find((s) => s.id === selectedSlot)!.tile!;
      const b = slot.tile!;
      if (pendingOp === '/' && Math.abs(b.expr.val) < EPS) {
        setFlash((f) => f + 1);
        return;
      }
      const node = makeOpNode(pendingOp, a.expr, b.expr);
      if (integerOnly && node.rat.d !== 1) {
        setFlash((f) => f + 1);
        return;
      }
      const newTile: Tile = { id: nextId, expr: node };
      setUndoStack((s) => [...s, slots]);
      setRedoStack([]);
      setNextId((n) => n + 1);
      // 2つ目に選んだ側に結果を残し、1つ目側を空スロットにする（詰めない）
      setSlots((prev) =>
        prev.map((s) => {
          if (s.id === slotId) return { ...s, tile: newTile };
          if (s.id === selectedSlot) return { ...s, tile: null };
          return s;
        }),
      );
      setSelectedSlot(null);
      setPendingOp(null);
    },
    [integerOnly, nextId, pendingOp, selectedSlot, slots],
  );

  const tapOp = useCallback(
    (op: Op) => {
      if (selectedSlot === null) return;
      setPendingOp((cur) => (cur === op ? null : op));
    },
    [selectedSlot],
  );

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setRedoStack((r) => [...r, slots]);
      setSlots(prev);
      setSelectedSlot(null);
      setPendingOp(null);
      return stack.slice(0, -1);
    });
  }, [slots]);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((u) => [...u, slots]);
      setSlots(next);
      setSelectedSlot(null);
      setPendingOp(null);
      return stack.slice(0, -1);
    });
  }, [slots]);

  const reset = useCallback(() => {
    if (undoStack.length === 0 && slots.every((s) => s.tile !== null)) return;
    setUndoStack((s) => [...s, slots]);
    setRedoStack([]);
    setSlots(makeSlots(numbers));
    setSelectedSlot(null);
    setPendingOp(null);
    setNextId(numbers.length + 1);
  }, [numbers, slots, undoStack.length]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo]);

  const pendingText = useMemo(() => {
    if (!selected) return '';
    const base = formatExpr(selected.expr);
    const opTxt = pendingOp ? ` ${{ '+': '+', '-': '−', '*': '×', '/': '÷' }[pendingOp]}` : '';
    return base + opTxt;
  }, [pendingOp, selected]);

  const finished = tiles.length === 1;
  const finalValue = finished ? tiles[0].expr.val : null;
  const finalFormula = finished ? formatExpr(tiles[0].expr) : '';

  return {
    slots,
    tiles,
    selectedSlot,
    pendingOp,
    tapNumber,
    tapOp,
    undo,
    redo,
    reset,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pendingText,
    finished,
    finalValue,
    finalFormula,
    flash,
  };
}
