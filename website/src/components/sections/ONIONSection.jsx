import Image from 'next/image'
import Link from 'next/link'
import image05 from '../../assets/images/image-05.png'

export default function ONIONSection() {
    return (
        <section className="container pb-4 md:pb-12">
            <div className="flex flex-col md:flex-row pt-4 gap-8 items-center">
                <div className="md:basis-5/12 lg:basis-6/12 md:order-1">
                    <Image
                        src={image05.src}
                        alt=""
                        height={574}
                        width={580}
                    />
                </div>
                <div className="md:basis-7/12 lg:basis-6/12">
                    <h2 className="font-bold text-[32px] mb-2 md:text-[54px] md:mb-4 tracking-tight">
                        Host with ONTON
                    </h2>
                    <h3 className="font-semibold text-[20px] md:text-[28px] mb-3 text-gray-700 leading-tight">
                        Transform Your Community Gatherings into Unforgettable Events
                    </h3>
                    <p className="mb-6 md:mb-8 md:text-[17px] text-gray-600 leading-relaxed">
                        Whether you are organizing a global Web3 conference, a developer hackathon, or a private VIP dinner, ONTON provides everything you need directly in Telegram. Collect Free RSVPs, accept Telegram Stars (Apple/Google Pay) or crypto, gate community chats automatically, and scan QR tickets at the door.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Link target='_blank' href='https://t.me/theontonbot/event' className='btn-primary btn text-center py-3 px-6 text-base font-semibold'>
                            🎟️ Create an Event Now
                        </Link>
                        <Link target='_blank' href='https://t.me/ontonsupport' className='btn-light btn text-center py-3 px-6 text-base font-semibold border border-gray-300'>
                            💬 Talk to Our Team
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    )
}
