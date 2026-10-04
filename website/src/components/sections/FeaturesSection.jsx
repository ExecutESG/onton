import Image from 'next/image'
import Link from 'next/link'
import imageArrow from '../../assets/images/arrow.png'
import Checkbox from '../ui/Checkbox'

export default function FeaturesSection() {
  return (
    <section className="relative mb-5 md:mb-16 bg-[#EFEFF4] py-10 scroll-mt-20" id="features">
      <div className="container relative">
        <h3 className="font-bold text-[20px] md:text-[36px] mb-5">Features</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
          <div className="text-center relative grid grid-cols-3 gap-8 px-7 py-6">
            <Image
              src={imageArrow.src}
              alt=""
              width={382}
              height={124}
              className="absolute top-1/2 -translate-y-1/2 left-0 right-0 w-full md:hidden"
            />
            <Image 
              src='/images/image-24.png'
              alt=""
              width={601}
              height={351} 
              className="mx-auto relative" />
            <Image 
              src='/images/image-25.png'
              alt=""
              width={601}
              height={351} 
              className="mx-auto relative" />
            <Image 
              src='/images/image-26.png'
              alt=""
              width={601}
              height={351} 
              className="mx-auto relative" />
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <Checkbox
              check
              label={
                <span>
                  <strong>1-Tap RSVP:</strong> Instant registration with zero wallet friction
                </span>
              }
            />
            <Checkbox
              check
              label={
                <span>
                  <strong>Flexible Checkout:</strong> Telegram Stars (Apple/Google Pay) or crypto (3% fee)
                </span>
              }
            />
            <Checkbox
              check
              label={
                <span>
                  <strong>Automated Chat Gating:</strong> Single-use invite links sent via Bot DM
                </span>
              }
            />
            <Checkbox
              check
              label={
                <span>
                  <strong>Fast Door QR Scanner:</strong> Instant mobile check-in for organizers
                </span>
              }
            />
            <Checkbox
              check
              label={
                <span>
                  <strong>Verified Attendance:</strong> Digital event badges and verified attendance records
                </span>
              }
            />
            <Checkbox
              check
              label={
                <span>
                  <strong>Viral In-Chat Cards:</strong> Dynamic preview cards tailored for Telegram groups
                </span>
              }
            />
            <Checkbox
              check
              label={
                <span>
                  <strong>Portable Credentials:</strong> Verifiable credentials attendees own and carry across platforms
                </span>
              }
            />
            <Checkbox
              check
              label={
                <span>
                  <strong>Organizer Dashboard:</strong> Real-time attendance, guest lists, and check-in stats
                </span>
              }
            />

            <Link
              target="_blank"
              href="https://t.me/theontonbot"
              className="btn btn-primary block md:inline-block md:w-[270px] mt-[28px] text-center"
            >
              Explore Mini App
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
