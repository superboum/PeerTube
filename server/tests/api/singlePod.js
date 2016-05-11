'use strict'

const async = require('async')
const chai = require('chai')
const expect = chai.expect
const fs = require('fs')
const keyBy = require('lodash/keyBy')
const pathUtils = require('path')

const webtorrent = require(pathUtils.join(__dirname, '../../lib/webtorrent'))
webtorrent.silent = true

const utils = require('./utils')

describe('Test a single pod', function () {
  let server = null
  let videoId = -1

  before(function (done) {
    this.timeout(20000)

    async.series([
      function (next) {
        utils.flushTests(next)
      },
      function (next) {
        utils.runServer(1, function (server1) {
          server = server1
          next()
        })
      },
      function (next) {
        utils.loginAndGetAccessToken(server, function (err, token) {
          if (err) throw err
          server.access_token = token
          next()
        })
      },
      function (next) {
        webtorrent.create({ host: 'client', port: '1' }, next)
      }
    ], done)
  })

  it('Should not have videos', function (done) {
    utils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(0)

      done()
    })
  })

  it('Should upload the video', function (done) {
    this.timeout(5000)
    utils.uploadVideo(server.url, server.access_token, 'my super name', 'my super description', 'video_short.webm', done)
  })

  it('Should seed the uploaded video', function (done) {
    // Yes, this could be long
    this.timeout(60000)

    utils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(1)

      const video = res.body[0]
      expect(video.name).to.equal('my super name')
      expect(video.description).to.equal('my super description')
      expect(video.podUrl).to.equal('http://localhost:9001')
      expect(video.magnetUri).to.exist
      expect(video.author).to.equal('root')
      expect(video.isLocal).to.be.true

      utils.testImage(server.url, 'video_short.webm', video.thumbnailPath, function (err, test) {
        if (err) throw err
        expect(test).to.equal(true)

        videoId = video.id

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })
  })

  it('Should get the video', function (done) {
    // Yes, this could be long
    this.timeout(60000)

    utils.getVideo(server.url, videoId, function (err, res) {
      if (err) throw err

      const video = res.body
      expect(video.name).to.equal('my super name')
      expect(video.description).to.equal('my super description')
      expect(video.podUrl).to.equal('http://localhost:9001')
      expect(video.magnetUri).to.exist
      expect(video.author).to.equal('root')
      expect(video.isLocal).to.be.true

      utils.testImage(server.url, 'video_short.webm', video.thumbnailPath, function (err, test) {
        if (err) throw err
        expect(test).to.equal(true)

        webtorrent.add(video.magnetUri, function (torrent) {
          expect(torrent.files).to.exist
          expect(torrent.files.length).to.equal(1)
          expect(torrent.files[0].path).to.exist.and.to.not.equal('')

          done()
        })
      })
    })
  })

  it('Should search the video', function (done) {
    utils.searchVideo(server.url, 'my', function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(1)

      const video = res.body[0]
      expect(video.name).to.equal('my super name')
      expect(video.description).to.equal('my super description')
      expect(video.podUrl).to.equal('http://localhost:9001')
      expect(video.author).to.equal('root')
      expect(video.isLocal).to.be.true

      utils.testImage(server.url, 'video_short.webm', video.thumbnailPath, function (err, test) {
        if (err) throw err
        expect(test).to.equal(true)

        done()
      })
    })
  })

  it('Should not find a search', function (done) {
    utils.searchVideo(server.url, 'hello', function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(0)

      done()
    })
  })

  it('Should remove the video', function (done) {
    utils.removeVideo(server.url, server.accessToken, videoId, function (err) {
      if (err) throw err

      fs.readdir(pathUtils.join(__dirname, '../../../test1/uploads/'), function (err, files) {
        if (err) throw err

        expect(files.length).to.equal(0)
        done()
      })
    })
  })

  it('Should not have videos', function (done) {
    utils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      expect(res.body).to.be.an('array')
      expect(res.body.length).to.equal(0)

      done()
    })
  })

  it('Should upload 6 videos', function (done) {
    this.timeout(25000)
    const videos = [
      'video_short.mp4', 'video_short.ogv', 'video_short.webm',
      'video_short1.webm', 'video_short2.webm', 'video_short3.webm'
    ]
    async.each(videos, function (video, callbackEach) {
      utils.uploadVideo(server.url, server.accessToken, video + ' name', video + ' description', video, callbackEach)
    }, done)
  })

  it('Should have the correct durations', function (done) {
    utils.getVideosList(server.url, function (err, res) {
      if (err) throw err

      const videos = res.body
      expect(videos).to.be.an('array')
      expect(videos.length).to.equal(6)

      const videosByName = keyBy(videos, 'name')
      expect(videosByName['video_short.mp4 name'].duration).to.equal(5)
      expect(videosByName['video_short.ogv name'].duration).to.equal(5)
      expect(videosByName['video_short.webm name'].duration).to.equal(5)
      expect(videosByName['video_short1.webm name'].duration).to.equal(10)
      expect(videosByName['video_short2.webm name'].duration).to.equal(5)
      expect(videosByName['video_short3.webm name'].duration).to.equal(5)

      done()
    })
  })

  it('Should have the correct thumbnails', function (done) {
    utils.getVideosList(server.url, function (err, res) {
      const videos = res.body

      async.each(videos, function (video, callbackEach) {
        if (err) throw err
        const videoName = video.name.replace(' name', '')

        utils.testImage(server.url, videoName, video.thumbnailPath, function (err, test) {
          if (err) throw err

          expect(test).to.equal(true)
          callbackEach()
        })
      }, done)
    })
  })

  after(function (done) {
    process.kill(-server.app.pid)
    process.kill(-webtorrent.app.pid)

    // Keep the logs if the test failed
    if (this.ok) {
      utils.flushTests(done)
    } else {
      done()
    }
  })
})
