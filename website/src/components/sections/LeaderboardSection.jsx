import Image from 'next/image';


export default function LeaderboardSection() {
    return (
        <section className="bg-gray-100">
            <div className="bg-white rounded-lg md:py-10">
                <div className="container">
                    <div className="flex flex-col md:flex-row pt-4 gap-8 items-center">

                        <div className="md:basis-5/12 md:order-1">
                            <Image src='/undraw_powerful.svg' alt="" height={490} width={473} />
                        </div>

                        <div className="md:basis-7/12">
                            <h2 
                                className="font-bold text-[32px] mb-2 md:text-[36px] md:mb-6"
                            >
                                Earn Points and Climb the Leaderboard
                            </h2>

                            <p className="text-[15px] mb-4 md:text-[17px] text-gray-600">
                                At ONTON, every event attendance counts. Your engagement tracks your verified check-ins and credentials. Each event you attend adds points to your profile and advances your rank on weekly and monthly leaderboards.
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </section>
    )
}
