import Appointment from '../models/Appointment'
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns'
import pt from 'date-fns/locale/pt';
import * as Yup from 'yup'
import User from '../models/User'
import File from '../models/File'

import Notification from '../../app/schemas/Notification'

import Mail from '../lib/Mail'

class AppointmentController {
    async index(req, res) {

        const { page = 1 } = req.query

        const appointment = await Appointment.findAll({
            where: { user_id: req.userId, canceled_at: null },
            order: ['data'],
            attributes: ['id', 'data'],
            limit: 20,
            offset: (page - 1) * 20,
            include: [
                {
                    model: User, as: 'provider',
                    attributes: ['id', 'name'],
                    include: [{
                        model: File, as: 'avatar',
                        attributes: ['id', 'path', 'url']
                    }]
                }
            ]

        })
        return res.json(appointment)
    }


    async store(req, res) {
        const schema = Yup.object().shape({
            provider_id: Yup.number().required(),
            data: Yup.date().required(),
        })

        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({ error: 'Validation fails' })

        }

        const { provider_id, data } = req.body

        /**
        * Check if provider is a provider
        */

        const isProvider = await User.findOne({
            where: { id: provider_id, provider: true }
        })

        if (!isProvider) {
            return res.status(401).json({ error: 'You can only create appointment with providers' })
        }

        const hourStart = startOfHour(parseISO(data))

        /**
        * Check for past dates
        */

        if (isBefore(hourStart, new Date())) {

            return res.status(400).json({ error: 'Past dates are not permitted' })
        }

        /**
        * Check date availabity
        */

        const checkAvailability = await Appointment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                data: hourStart
            }
        })

        if (checkAvailability) {
            return res.status(401).json({ error: 'Appointment date is not available' })
        }

        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            data
        })

        /**
        * Notify appointment provider
        */

        const user = await User.findByPk(req.userId)
        const formattedDate = format(
            hourStart,
            "'dia' dd 'de' MMMM', às' H:mm'h'",
            {
                locale: pt,
            }
        )

        await Notification.create({
            content: `Novo Agendamento de ${user.name} para o ${formattedDate}`,
            user: provider_id
        })
        return res.json(appointment)
    }

    async delete(req, res) {
        const appointment = await Appointment.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['name', 'email']
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['name'],
                },
            ]
        })

        console.log(appointment.user_id)
        console.log(req.userId)

        if (appointment.user_id !== req.userId) {
            return res.status(401).json({
                error: "You don't have  permission to cancell this appointment"
            })

        }

        const dateWithSubHours = subHours(appointment.data, 2)
        if (isBefore(dateWithSubHours, new Date())) {
            return res.status(401).json({
                error: "You can only cancel appointment 2 hours in advance"
            })
        }

        appointment.canceled_at = JSON.stringify(new Date())

        await appointment.save()
        await Mail.sendMail({
            to: `${appointment.provider.name} <${appointment.provider.email}>`,
            subject: 'Agendamento Cancelado',
            template: 'cancellation',
            context: {
                provider: appointment.provider.name,
                user: appointment.user.name,
                date: format(appointment.data, "'dia' dd 'de' MMMM', às' H:mm'h'", {
                    locale: pt,
                }),
            }
        })

        return res.json(appointment)

    }

}

export default new AppointmentController()