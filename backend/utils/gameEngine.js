// Basic Matatu engine (simplified)
const SUITS = ['H', 'C', 'D', 'S']; // Hearts, Clubs, Diamonds, Spades
const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const createDeck = () => {
  const deck = [];
  SUITS.forEach(s => RANKS.forEach(r => deck.push(r + s)));
  return shuffle(deck);
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const deal = (deck) => {
  return [deck.splice(0, 5), deck.splice(0, 5)]; // 2 players for now
};

const validMove = (card, topCard) => {
  // Same suit or same rank is allowed
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const topSuit = topCard.slice(-1);
  const topRank = topCard.slice(0, -1);
  return suit === topSuit || rank === topRank;
};

module.exports = { createDeck, deal, validMove };
