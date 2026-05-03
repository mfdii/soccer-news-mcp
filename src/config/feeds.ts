export interface FeedSource {
  name: string;
  rssUrl: string;
  category: string;
}

export const DEFAULT_FEEDS: FeedSource[] = [
  {
    name: 'BBC Sport Football',
    rssUrl: 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    category: 'soccer',
  },
  {
    name: 'ESPN Soccer',
    rssUrl: 'https://www.espn.com/espn/rss/soccer/news',
    category: 'soccer',
  },
  {
    name: 'The Guardian Football',
    rssUrl: 'https://www.theguardian.com/football/rss',
    category: 'soccer',
  },
  {
    name: 'Sky Sports Premier League',
    rssUrl: 'https://www.skysports.com/rss/12040',
    category: 'premier-league',
  },
  {
    name: 'Goal.com',
    rssUrl: 'https://www.goal.com/feeds/en/news',
    category: 'soccer',
  },
  {
    name: 'FourFourTwo',
    rssUrl: 'https://www.fourfourtwo.com/feed',
    category: 'soccer',
  },
  {
    name: 'Sports Illustrated Soccer',
    rssUrl: 'https://www.si.com/rss/si_soccer.rss',
    category: 'soccer',
  },
  {
    name: 'Yahoo Sports Soccer',
    rssUrl: 'https://sports.yahoo.com/soccer/rss.xml',
    category: 'soccer',
  },
  {
    name: 'ESPN FC',
    rssUrl: 'https://www.espn.com/espn/rss/soccer/news',
    category: 'soccer',
  },
  {
    name: 'BBC Sport',
    rssUrl: 'https://feeds.bbci.co.uk/sport/rss.xml',
    category: 'sports',
  },
];
