import Sequelize from 'sequelize'
import mongoose from 'mongoose'
import User from '../app/models/User'
import File from '../app/models/File'
import Appointment from '../app/models/Appointment';

import databaseConfig from '../config/database'

const models = [User, File, Appointment];


class Database {
    constructor() {
        this.init();
        this.mongo()
    }

    init() {
        this.connection = new Sequelize(databaseConfig)
        models
            .map(model => model.init(this.connection))
            .map(model => model.associate && model.associate(this.connection.models))
    }
    mongo() {

        const options = {
            reconnectTries: Number.MAX_VALUE, reconnectInterval: 500,
            poolSize: 5, useNewUrlParser: true, useCreateIndex: true,
            useUnifiedTopology: true
        }
        const url = "mongodb+srv://usuario_admin:everton3b@cluster0-lqciw.mongodb.net/gobarber?retryWrites=true&w=majority"
        mongoose.connect(url, options)

        mongoose.connection.on('error', (err) => {
            console.log('Erro na conexão com o banco de dados: ' + err)
        })
        mongoose.connection.on('disconnected', () => {
            console.log('Aplicação disconetada do banco de dados!')
        })
        mongoose.connection.once('connected', () => {
            console.log('Aplicação conectada ao banco de dados!')
        })
    }
}

export default new Database();