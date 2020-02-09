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

const getTMDbNormalData = async (format, genres, rating, fromYear, toYear, page, withQuery, tab) => {
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
  if (withQuery) {
    params += `&${withQuery}`;
  }
  const data = await fetch(`${TMDbUrl}/${format}/${tab}?api_key=${TMDbApiKey}${params}`)
    .then(res => res.json());
  return { totalResults: data.total_results, data: data.results };
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

const getAddiionalDetails = async (format, item) => {
  const externalIds = await fetch(`${TMDbUrl}/${format}/${item.id}/external_ids?api_key=${TMDbApiKey}`)
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
}

const getFullData = async (format, genres, rating, fromYear, toYear, page, withQuery, searchQuery, tab) => {
  if (searchQuery !== '' && searchQuery !== undefined) {
    TMDbResponse = await getTMDbSearchData(format, searchQuery, page);
  } else if (tab !== 'trending') {
    TMDbResponse = await getTMDbNormalData(format, genres, rating, fromYear, toYear, page, withQuery, tab);
  } else {
    TMDbResponse = await getTMDbTrendingData(format, page);
  }
  let fetchedData = await Promise.all(
    TMDbResponse.data.map(async item => await getAddiionalDetails(format, item))
  );
  return { data: fetchedData, total_results: TMDbResponse.totalResults };
}

const getTMDbDetails = async (format, id) => {
  const details = await fetch(`${TMDbUrl}/${format}/${id}?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const credits = await fetch(`${TMDbUrl}/${format}/${id}/credits?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const keywords = await fetch(`${TMDbUrl}/${format}/${id}/keywords?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const videos = await fetch(`${TMDbUrl}/${format}/${id}/videos?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  const casts = credits.cast.slice(0, 10),
    video = videos.results.find(item => item.site === 'YouTube' && item.type === 'Trailer');
  let recommendations = await fetch(`${TMDbUrl}/${format}/${id}/recommendations?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  recommendations = recommendations.results.length 
    ? await Promise.all( 
      recommendations.results.map(async item => await getAddiionalDetails(format, item))
    ) : [];
  const baseInfo = {
    ...await getAddiionalDetails(format, details), 
    casts, video, recommendations,
    keywords: format === 'movie' ? keywords.keywords : keywords.results,
  };
  if (format === 'movie') {
    const directors = credits.crew.filter(item => item.job === 'Director'),
      writers = credits.crew.filter(item => item.department === 'Writing')
    return {...baseInfo, directors, writers}
  } else {
    const producers = credits.crew.filter(item => item.job === 'Executive Producer');
    return {...baseInfo, producers}
  }
}

const getOtherDetails = async (format, id) => {
  const data = await fetch(`${TMDbUrl}/${format}/${id}?api_key=${TMDbApiKey}`)
    .then(res => res.json());
  return data;
}

module.exports = { getFullData, getGenres, getTMDbDetails, getOtherDetails }