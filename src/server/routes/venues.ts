import { Router } from 'express';
import { VenueService } from '../domain/venueService.js';

export const venuesRouter = Router();

// GET /api/venues/search?q=...
venuesRouter.get('/search', async (req, res) => {
  try {
    const query = (req.query.q as string) || 'coworking Bellandur';
    const venues = await VenueService.searchVenues(query);
    res.json({ venues });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
