export interface ISetting {
  platform: 'github' | 'coding' | 'sftp' | 'gitee' | 'netlify' | 'oss'
  domain: string
  repository: string
  branch: string
  username: string
  email: string
  tokenUsername: string
  token: string
  cname: string
  port: string
  server: string
  password: string
  privateKey: string
  remotePath: string
  proxyPath: string
  proxyPort: string
  enabledProxy: 'direct' | 'proxy'
  netlifyAccessToken: string
  netlifySiteId: string

  // OSSConfigs
  ossAccessKeyId: '',
  ossAccessKeySecret: '',
  ossBucket: '',
  ossRegion: '',
  ossEndpoint: '',
  ossPrefix: '',
  ossCname: false,
  [index: string]: string | boolean | number
}

export interface IDisqusSetting {
  api: string
  apikey: string
  shortname: string
}
export interface IGitalkSetting {
  clientId: string
  clientSecret: string
  repository: string
  owner: string
}

export interface ICommentSetting {
  commentPlatform: string
  showComment: boolean
  disqusSetting: IDisqusSetting
  gitalkSetting: IGitalkSetting
}
