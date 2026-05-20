import type { CardId, Intent } from '../sim/types';

let serial = 0;

export function nextTraceId(prefix = 'input'): string {
  serial += 1;
  return `${prefix}-${serial}`;
}

export function bindKeyboard(getCards: () => CardId[], onIntent: (intent: Intent) => void): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    const cards = getCards();
    const index = Number(event.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < cards.length) {
      onIntent({
        type: 'play-card',
        cardId: cards[index],
        traceId: nextTraceId('key')
      });
    }

    if (event.key.toLowerCase() === 'r') {
      onIntent({
        type: 'restart-current-level',
        traceId: nextTraceId('restart')
      });
    }

    if (event.key.toLowerCase() === 'c') {
      onIntent({
        type: 'continue-activity',
        traceId: nextTraceId('continue')
      });
    }

    if (event.key.toLowerCase() === 'd') {
      onIntent({
        type: 'deal-hand',
        traceId: nextTraceId('deal')
      });
    }

    if (event.key.toLowerCase() === 'e' || event.key === ' ') {
      event.preventDefault();
      onIntent({
        type: 'end-turn',
        traceId: nextTraceId('end-turn')
      });
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}
