type PointerPosition = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY'>;
type PointerStart = PointerPosition & Pick<PointerEvent, 'button' | 'pointerType'>;

/** Classifies a tap without changing camera controls or the selected lot. */
export class PointerSelectionGesture {
  private pointers = new Set<number>();
  private candidate: { id: number; x: number; y: number; limit: number; dragged: boolean } | null = null;

  constructor(private readonly mouseLimit = 5) {}

  get active() { return this.pointers.size > 0; }

  start(event: PointerStart) {
    const repeated = this.pointers.has(event.pointerId);
    this.pointers.add(event.pointerId);
    if (repeated || this.pointers.size !== 1 || event.button !== 0) {
      this.candidate = null;
      return;
    }
    this.candidate = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      limit: event.pointerType === 'touch' ? 10 : event.pointerType === 'pen' ? 8 : this.mouseLimit,
      dragged: false,
    };
  }

  move(event: PointerPosition) {
    const tap = this.candidate;
    if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > tap.limit) tap.dragged = true;
  }

  end(event: PointerPosition): boolean {
    this.move(event);
    const tap = this.candidate;
    this.pointers.delete(event.pointerId);
    if (tap?.id !== event.pointerId) return false;
    this.candidate = null;
    return !tap.dragged && !this.active;
  }

  cancel(pointerId: number) {
    this.pointers.delete(pointerId);
    this.candidate = null;
  }

  reset() {
    this.pointers.clear();
    this.candidate = null;
  }
}
