import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

const client = axios.create({ baseURL: BASE_URL })

client.interceptors.request.use(config => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.error || err.message || 'Request failed'
    throw new Error(msg)
  }
)

export const api = {
  get: (url: string) => client.get(url),
  post: (url: string, data?: any) => client.post(url, data),
  patch: (url: string, data?: any) => client.patch(url, data),
  delete: (url: string) => client.delete(url),
}
