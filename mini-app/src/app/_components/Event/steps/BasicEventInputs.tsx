import { KSheet } from "@/components/ui/drawer";
import { useGetHubsManageEvent } from "@/hooks/events.hooks";
import { useCreateEventStore } from "@/zustand/createEventStore";
import { Block, Button, Checkbox, ListInput, ListItem, Toolbar } from "konsta/react";
import ListLayout from "../../atoms/cards/ListLayout";
import EventCategoryPicker from "../../molecules/pickers/EventCategoryPicker";
import TonHubPicker from "../../molecules/pickers/TonHubpicker";
import { ImageUpload } from "./ImageUpload";

interface Props {
  termsChecked: boolean;
  setTermsChecked: (_checked: boolean) => void;
  showTermsError: boolean;
}

function BasicEventInputs(props: Props) {
  const errors = useCreateEventStore((state) => state.generalStepErrors);
  const eventData = useCreateEventStore((state) => state.eventData);

  const { edit: editOptions } = useCreateEventStore();
  const setEventData = useCreateEventStore((state) => state.setEventData);
  const clearImageError = useCreateEventStore((state) => state.clearImageErrors);
  const hubsResponse = useGetHubsManageEvent();

  return (
    <ListLayout
      title=""
      isLoading={hubsResponse.isLoading}
    >
      <ListInput
        outline
        placeholder="Event Title"
        name="title"
        label="Event Title"
        defaultValue={eventData?.title}
        error={errors?.title?.join(". ")}
      />
      <ListInput
        outline
        placeholder="Subtitle"
        name="subtitle"
        label="Subtitle"
        defaultValue={eventData?.subtitle}
        error={errors?.subtitle?.join(". ")}
      />
      <TonHubPicker
        onValueChange={(data) => {
          if (data) {
            setEventData({ society_hub: data });
          }
        }}
        value={eventData?.society_hub}
        errors={errors?.hub}
      />
      <EventCategoryPicker
        onValueChange={(data) => {
          console.log("data", data);
          if (data) {
            setEventData({ category_id: data.category_id });
          }
        }}
        value={eventData?.category_id}
        errors={errors?.category_id}
      />
      <ListInput
        type="textarea"
        outline
        placeholder="Description"
        label="Description"
        name="description"
        inputClassName="min-h-20"
        error={errors?.description?.join(". ")}
        defaultValue={eventData?.description}
      />
      {!editOptions?.eventHash && <TermsCheckbox {...props} />}
      <ImageUpload
        isError={Boolean(errors?.image_url)}
        clearError={clearImageError}
      />
    </ListLayout>
  );
}

export default BasicEventInputs;

function TermsCheckbox({ termsChecked, setTermsChecked, showTermsError }: Props) {
  return (
    <>
      <KSheet
        trigger={(open, setOpen) => (
          <ListItem
            className="mr-4"
            label
            titleWrapClassName="text-sm font-bold"
            title="I Agree to the terms and conditions"
            media={
              <Checkbox
                name="terms-and-conditions"
                defaultChecked={termsChecked}
                checked={termsChecked}
                onChange={(e) => {
                  const { checked } = e.target;
                  if (!checked) {
                    setTermsChecked(false);
                    return;
                  }
                  setOpen(true);
                }}
              />
            }
            {...(showTermsError && { subtitle: <div className="text-xs text-red-500">Please agree to continue</div> })}
          />
        )}
      >
        {(open, setOpen) => (
          <>
            <Toolbar top>
              <div className="text-center flex-1 font-bold">Terms and Conditions</div>
            </Toolbar>
            <Block>
              <b>Compliance with Terms of Service</b>
              <ul className="list-disc ml-4">
                <li>
                  Ensure your events and materials comply with &nbsp;
                  <a
                    className="text-primary font-bold"
                    target="blank"
                    href="https://onton.live/tos"
                  >
                    ONTON’s Terms of Service.
                  </a>
                </li>
                <li>
                  Avoid content that is illegal, harmful, or infringes on intellectual property rights. Examples of
                  prohibited content include:
                  <ul className="list-circle ml-4">
                    <li>Pornographic material</li>
                    <li>Activities related to organized crime, terrorism, or illicit drugs</li>
                    <li>Discrimination, hate speech, or other harmful conduct</li>
                  </ul>
                </li>
              </ul>
              <b className="block mt-1">Respect User Privacy</b>
              <ul className="list-disc ml-4">
                <li>Do not engage in activities that compromise the privacy of other users.</li>
                <li>Avoid actions that disrupt the functionality of the platform.</li>
              </ul>
              <b className="block mt-1">Engage Participants</b>
              <ul className="list-disc ml-4">
                <li>
                  Enable participants to check in during your events. This allows them to receive SBT awards as proof of
                  attendance.
                </li>
              </ul>
              <b className="block mt-1">Foster a Positive Experience</b>
              <ul className="list-disc ml-4">
                <li>
                  Create events that are inclusive, respectful, and aligned with ONTON&lsquo;s values to ensure a great
                  experience for all users.
                </li>
              </ul>
              <div className="mt-6">
                <Button
                  className="py-5 rounded-3xl"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTermsChecked(true);
                    setOpen(false);
                  }}
                >
                  I agree to the terms and conditions
                </Button>
              </div>
            </Block>
          </>
        )}
      </KSheet>
    </>
  );
}
