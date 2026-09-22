type MethodType = 'GET' | 'POST' | 'PUT' | 'DELETE'
type RequestType = 'text' | 'arrayBuffer' | 'blob' | 'json'

interface RequestOptions {
  method?: MethodType
  responseType?: RequestType
  data?: Record<string, any>
  params?: Record<string, any>
  headers?: Record<string, any>
}

const request = async (url: string, body?: RequestOptions): Promise<void> => {
  const headers: Record<string, any> = {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
  }
  const method: MethodType = body?.method || 'POST'
  const responseType: RequestType = body?.responseType || 'json'
  Reflect.deleteProperty(body ?? {}, 'responseType')

  const data: Record<string, any> = body?.data || {}
  const params: Record<string, any> = body?.params || {}

  const requestConfig = {
    method,
    headers,
    body: method !== 'GET' ? JSON.stringify(data) : undefined
  }
  const finalUrl =
    method === 'GET' ? `${url}?${new URLSearchParams(params).toString()}` : url

  const response = await fetch(finalUrl, requestConfig)
  const res = await response[responseType]()

  return new Promise((resolve) => {
    resolve(res)
  })
}

export default request
