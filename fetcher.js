const fetch = require('node-fetch');
require('dotenv').config();

const TMDbUrl = 'https://api.themoviedb.org/3',
  TMDbImageURL = 'https://image.tmdb.org/t/p/w500',
  TMDbApiKey = process.env.TMDB_API_KEY;

const OMDbUrl = 'https://www.omdbapi.com',
  OMDbApiKey = process.env.OMDB_API_KEY;

const getGenres = async (format) => {
  let data = await fetch(`${TMDbUrl}/genre/${format}/list?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  return data.genres;
}

const getOMDbRatings = async (IMDbId) => {
  const OMDbData = await fetch(`${OMDbUrl}/?apiKey=${OMDbApiKey}&i=${IMDbId}`)
    .then(res => res.json());
  let rt_score;
  if (OMDbData.Ratings && OMDbData.Ratings.length) {
    rt_score = OMDbData.Ratings.find(item => item.Source === 'Rotten Tomatoes');
    rt_score = rt_score && rt_score.Value;
  }
  return { 
    imdb_rating: OMDbData.imdbRating,
    imdb_votes: OMDbData.imdbVotes,
    meta_score: OMDbData.Metascore,
    rt_score
  };
}

const getTMDbSearchData = async (format, query, page) => {
  let params = `&page=${page}&query=${query}`;
  let data = await fetch(`${TMDbUrl}/search/${format}?api_key=${TMDbApiKey}${params}`)
    .then(res => res.json());
  return { totalResults: data.total_results, data: data.results };
}

const getTMDbTrendingData = async (format, page) => {
  let data = await fetch(`${TMDbUrl}/trending/${format}/day?api_key=${TMDbApiKey}&page=${page}`)
    .then(res => res.json());
  return { totalResults: data.total_results, data: data.results };
}

const getTMDbNormalData = async (format, genres, rating, fromYear, toYear, page, tab) => {
  let params = `&page=${page}`;
  if (genres && genres.length) {
    params += `&with_genres=${genres.join(',')}`;
  }
  if (rating) {
    params += `&vote_average.gte=${rating}`
  }
  if (fromYear) {
    params += format === 'movie' 
      ? `&primary_release_date.gte=${fromYear}-01-01`
      : `&air_date.gte=${fromYear}-01-01`;
  }
  if (toYear) {
    params += format === 'movie' 
      ? `&primary_release_date.lte=${toYear}-12-31`
      : `&air_date.lte=${toYear}-12-31`;
  }
  let data = await fetch(`${TMDbUrl}/${format}/${tab}?api_key=${TMDbApiKey}${params}`)
    .then(res => res.json());
  return { totalResults: data.total_results, data: data.results };
}

const getTMDbDetails = async (format, id) => {
  const details = await fetch(`${TMDbUrl}/${format}/${id}?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const externalIds = await fetch(`${TMDbUrl}/${format}/${id}/external_ids?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const credits = await fetch(`${TMDbUrl}/${format}/${id}/credits?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const keywords = await fetch(`${TMDbUrl}/${format}/${id}/keywords?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const recommendations = await fetch(`${TMDbUrl}/${format}/${id}/recommendations?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const videos = await fetch(`${TMDbUrl}/${format}/${id}/videos?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const casts = credits.cast.slice(0, 10),
    video = videos.results.find(item => item.site === 'YouTube' && item.type === 'Trailer');
  const ratings = externalIds.imdb_id && await getOMDbRatings(externalIds.imdb_id);  
  const baseInfo = {
    ...details, ...externalIds, ...ratings,
    casts, video, 
    keywords: format === 'movie' ? keywords.keywords : keywords.results,
    recommendations: recommendations.results,
  }
  if (format === 'movie') {
    const directors = credits.crew.filter(item => item.job === 'Director'),
      writers = credits.crew.filter(item => item.department === 'Writing')
    return {...baseInfo, directors, writers}
  } else {
    const producers = credits.crew.filter(item => item.job === 'Executive Producer');
    return {...baseInfo, producers}
  }
}

const getFullData = async (format, genres, rating, fromYear, toYear, page, query, tab) => {
  if (query !== '' && query !== undefined) {
    TMDbResponse = await getTMDbSearchData(format, query, page);
  } else if (tab !== 'trending') {
    TMDbResponse = await getTMDbNormalData(format, genres, rating, fromYear, toYear, page, tab);
  } else {
    TMDbResponse = await getTMDbTrendingData(format, page);
  }
  let fetchedData = await Promise.all(
    TMDbResponse.data.map(async item => {
      const TMDbId = item.id;
      let externalIds = await fetch(`${TMDbUrl}/${format}/${TMDbId}/external_ids?api_key=${TMDbApiKey}`)
        .then(res => res.json());
      item = {...item, ...externalIds};
      if (item.poster_path) {
        const poster_path = `${TMDbImageURL}${item.poster_path}`;
        item = {...item, poster_path};
      }
      if (item.imdb_id) {
        const OMDbRatings = await getOMDbRatings(item.imdb_id);
        item = {...item, ...OMDbRatings};
      }
      return {...item, format};
    })
  );
  return { data: fetchedData, total_results: TMDbResponse.totalResults };
}

module.exports = { getFullData, getGenres, getTMDbDetails }