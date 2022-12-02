import fs from 'fs'
import path from 'path'
import axios from 'axios'
import OSS, { NormalSuccessResponse } from 'ali-oss'
import normalizePath from 'normalize-path'
import crypto from 'crypto'
import util from 'util'
import { ISetting } from '@/interfaces/setting'
import Model from '../../model'
import { IApplication } from '../../interfaces/application'

const asyncReadFile = util.promisify(fs.readFile)

export default class OssApi extends Model {
  private setting: ISetting

  private appInstance: IApplication

  private Oss: OSS | undefined

  private inputDir: string

  constructor(appInstance: IApplication) {
    super(appInstance)
    this.setting = appInstance.db.setting
    this.appInstance = appInstance
    this.inputDir = appInstance.buildDir
  }

  initOss() {
    if (!this.setting.ossAccessKeyId) return null
    if (this.Oss) return this.Oss
    const {
      ossAccessKeyId,
      ossAccessKeySecret,
      ossBucket,
      ossEndpoint,
      ossCname,
    } = this.setting || {}
    this.Oss = new OSS({
      accessKeyId: ossAccessKeyId,
      accessKeySecret: ossAccessKeySecret,
      bucket: ossBucket,
      endpoint: ossEndpoint,
      cname: ossCname,
    })
    return this.Oss
  }

  async remoteDetect() {
    try {
      const oss = this.initOss()
      if (!oss) return Promise.reject(new Error('oss is not init'))

      const res = await oss.getBucketInfo(this.setting.ossBucket)
      if (res && res.res.status === 200) {
        return {
          success: true,
          message: res.data,
        }
      }

      return {
        success: false,
        message: res.data,
      }
    } catch (e) {
      return {
        success: false,
        message: e,
      }
    }
  }

  async publish() {
    const result = {
      success: true,
      message: '同步成功',
      data: null,
    }
    console.log(123)
    try {
      const localFilesList = await this.prepareLocalFilesList()
      const filePaths = Object.keys(localFilesList.files)
      console.log('filePaths', filePaths)
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i]
        try {
          // eslint-disable-next-line no-await-in-loop
          const res = await this.uploadFile(filePath)
          console.log('res', res)
          if (res && res.status !== 200) return Promise.reject(res)
          return res
        } catch (e) {
          return Promise.reject(e)
        }
      }

      return result

      // @ts-ignore
    } catch (e: Error) {
      result.success = false
      result.message = `[Server] 同步失败： ${e.message}`
    }
  }

  async prepareLocalFilesList() {
    const tempFileList: any = this.readDirRecursiveSync(this.inputDir)
    const fileList: any = {}
    for (const filePath of tempFileList) {
      if (fs.lstatSync(path.join(this.inputDir, filePath)).isDirectory()) {
        continue
      }

      // eslint-disable-next-line no-await-in-loop
      const fileHash = await this.getFileHash(path.join(this.inputDir, filePath))
      const fileKey = `/${filePath}`.replace(/\/\//gmi, '/')
      fileList[fileKey] = fileHash
    }

    return Promise.resolve({ files: fileList })
  }

  readDirRecursiveSync(dir: string, fileList?: any) {
    const files = fs.readdirSync(dir)
    fileList = fileList || []

    files.forEach((file) => {
      if (this.fileIsDirectory(dir, file)) {
        fileList = this.readDirRecursiveSync(path.join(dir, file), fileList)
        return
      }

      if (this.fileIsNotExcluded(file)) {
        fileList.push(this.getFilePath(dir, file))
      }
    })

    return fileList
  }

  fileIsDirectory(dir: string, file: string) {
    return fs.statSync(path.join(dir, file)).isDirectory()
  }

  fileIsNotExcluded(file: string) {
    return file.indexOf('.') !== 0 || file === '.htaccess' || file === '_redirects'
  }

  getFilePath(dir: string, file: string, includeInputDir = false) {
    if (!includeInputDir) {
      dir = dir.replace(this.inputDir, '')
    }

    return normalizePath(path.join(dir, file))
  }

  getFileHash(fileName: string) {
    return new Promise((resolve, reject) => {
      const shaSumCalculator = crypto.createHash('sha1')

      try {
        const fileStream = fs.createReadStream(fileName)
        fileStream.on('data', fileContentChunk => shaSumCalculator.update(fileContentChunk))
        fileStream.on('end', () => resolve(shaSumCalculator.digest('hex')))
      } catch (e) {
        return reject(e)
      }
    })
  }

  async uploadFile(filePath: string, isRetry = false): Promise<OSS.NormalSuccessResponse> {
    const fullFilePath = this.getFilePath(this.inputDir, filePath, true)
    const fileContent = await asyncReadFile(fullFilePath)
    console.log('fullFilePath', fullFilePath)
    const store = this.initOss()
    if (store) {
      try {
        const { res } = await store.put(filePath, fileContent) || {}
        console.log('put res', res)
        if ((!res || res.status !== 200) && !isRetry) {
          return this.uploadFile(filePath, true)
        }
        return Promise.resolve(res)
      } catch (e) {
        return Promise.reject(e)
      }
    }

    return Promise.reject(new Error('OSS 初始化失败'))
  }
}
