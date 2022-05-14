import { createSlice } from '@reduxjs/toolkit'
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/dist/query/react'
import { AssetId } from '@shapeshiftoss/caip'
import {
  FiatMarketDataArgs,
  FiatPriceHistoryArgs,
  findAll,
  findByAssetId,
  findByFiatSymbol,
  findPriceHistoryByAssetId,
  findPriceHistoryByFiatSymbol,
  SupportedFiatCurrencies,
} from '@shapeshiftoss/market-service'
import { HistoryData, HistoryTimeframe, MarketCapResult, MarketData } from '@shapeshiftoss/types'

export type PriceHistoryData = {
  [k: AssetId]: HistoryData[]
}

type PriceHistoryByTimeframe = {
  [k in HistoryTimeframe]: PriceHistoryData
}

type CommonMarketDataState = {
  byId: {
    [k: string]: MarketData
  }
  priceHistory: PriceHistoryByTimeframe
}

type FiatMarketDataState = CommonMarketDataState & {
  ids: SupportedFiatCurrencies[]
}

type CryptoMarketDataState = CommonMarketDataState & {
  ids: AssetId[]
}

export type MarketDataState = {
  crypto: CryptoMarketDataState
  fiat: FiatMarketDataState
}

const initialPriceHistory: PriceHistoryByTimeframe = {
  [HistoryTimeframe.HOUR]: {},
  [HistoryTimeframe.DAY]: {},
  [HistoryTimeframe.WEEK]: {},
  [HistoryTimeframe.MONTH]: {},
  [HistoryTimeframe.YEAR]: {},
  [HistoryTimeframe.ALL]: {},
}

const initialState: MarketDataState = {
  crypto: {
    byId: {},
    ids: [],
    priceHistory: initialPriceHistory,
  },
  fiat: {
    byId: {},
    ids: [],
    priceHistory: initialPriceHistory,
  },
}

export const marketData = createSlice({
  name: 'marketData',
  initialState,
  reducers: {
    clear: () => initialState,
    setCryptoMarketData: (state, { payload }) => {
      state.crypto.byId = { ...state.crypto.byId, ...payload } // upsert
      const ids = Array.from(new Set([...state.crypto.ids, ...Object.keys(payload)]))
      state.crypto.ids = ids // upsert unique
    },
    setCryptoPriceHistory: (
      state,
      { payload }: { payload: { data: HistoryData[]; args: FindPriceHistoryByAssetIdArgs } },
    ) => {
      const { args, data } = payload
      const { assetId, timeframe } = args
      state.crypto.priceHistory[timeframe][assetId] = data
    },
    setFiatMarketData: (state, { payload }) => {
      state.fiat.byId = { ...state.fiat.byId, ...payload } // upsert
      const ids = Array.from(new Set([...state.fiat.ids, ...Object.keys(payload)])).map(
        id => id as SupportedFiatCurrencies,
      )
      state.fiat.ids = ids
    },
    setFiatPriceHistory: (
      state,
      { payload }: { payload: { data: HistoryData[]; args: FiatPriceHistoryArgs } },
    ) => {
      const { args, data } = payload
      const { symbol, timeframe } = args
      state.fiat.priceHistory[timeframe][symbol] = data
    },
  },
})

type FindPriceHistoryByAssetIdArgs = { assetId: AssetId; timeframe: HistoryTimeframe }

export const marketApi = createApi({
  reducerPath: 'marketApi',
  // not actually used, only used to satisfy createApi, we use a custom queryFn
  baseQuery: fetchBaseQuery({ baseUrl: '/' }),
  // refetch if network connection is dropped, useful for mobile
  refetchOnReconnect: true,
  endpoints: build => ({
    findAll: build.query<MarketCapResult, void>({
      // top 1000 assets
      queryFn: async (args, { dispatch }) => {
        try {
          const data = await findAll({ count: 1000 })
          const payload = { args, data }
          dispatch(marketData.actions.setCryptoMarketData(payload))
          return { data }
        } catch (e) {
          const error = { data: `findAll: could not find marketData for all assets`, status: 404 }
          return { error }
        }
      },
    }),
    findByAssetId: build.query<MarketCapResult, AssetId>({
      queryFn: async (assetId: AssetId, { dispatch }) => {
        try {
          const currentMarketData = await findByAssetId({ assetId })
          if (!currentMarketData) throw new Error()
          const data = { [assetId]: currentMarketData }
          dispatch(marketData.actions.setCryptoMarketData(data))
          return { data }
        } catch (e) {
          const error = { data: `findByAssetId: no market data for ${assetId}`, status: 404 }
          return { error }
        }
      },
    }),
    findPriceHistoryByAssetId: build.query<HistoryData[], FindPriceHistoryByAssetIdArgs>({
      queryFn: async (args, { dispatch }) => {
        const { assetId, timeframe } = args
        try {
          const data = await findPriceHistoryByAssetId({ timeframe, assetId })
          const payload = { args, data }
          dispatch(marketData.actions.setCryptoPriceHistory(payload))
          return { data }
        } catch (e) {
          const error = {
            data: `findPriceHistoryByAssetId: error fetching price history for ${assetId}`,
            status: 400,
          }
          return { error }
        }
      },
    }),
    findByFiatSymbol: build.query<MarketCapResult, FiatMarketDataArgs>({
      queryFn: async ({ symbol }: { symbol: SupportedFiatCurrencies }, baseQuery) => {
        try {
          const currentMarketData = await findByFiatSymbol({ symbol })
          if (!currentMarketData) throw new Error()
          const data = { [symbol]: currentMarketData }
          baseQuery.dispatch(marketData.actions.setFiatMarketData(data))
          return { data }
        } catch (e) {
          console.error(e)
          const error = { data: `findByFiatSymbol: no market data for ${symbol}`, status: 404 }
          return { error }
        }
      },
    }),
    findPriceHistoryByFiatSymbol: build.query<HistoryData[], FiatPriceHistoryArgs>({
      queryFn: async (args, { dispatch }) => {
        const { symbol, timeframe } = args
        try {
          const data = await findPriceHistoryByFiatSymbol({ timeframe, symbol })
          const payload = { args, data }
          dispatch(marketData.actions.setFiatPriceHistory(payload))
          return { data }
        } catch (e) {
          const error = {
            data: `findPriceHistoryByFiatSymbol: error fetching price history for ${symbol}`,
            status: 400,
          }
          return { error }
        }
      },
    }),
  }),
})

export const { useFindAllQuery, useFindByAssetIdQuery, useFindPriceHistoryByAssetIdQuery } =
  marketApi
