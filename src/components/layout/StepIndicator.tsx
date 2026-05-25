import { REGISTRATION_STEPS } from "@/types";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="w-full px-4 py-6">
      <div className="flex items-center justify-between">
        {REGISTRATION_STEPS.map((step, index) => {
          const isCompleted = currentStep > step.step;
          const isActive = currentStep === step.step;

          return (
            <div key={step.step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                    isCompleted && "bg-green-700 text-white",
                    isActive && "bg-green-700 text-white ring-4 ring-green-100",
                    !isCompleted && !isActive && "bg-gray-100 text-gray-400"
                  )}
                >
                  {isCompleted ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.step
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1 text-xs font-medium hidden sm:block",
                    isActive ? "text-green-700" : "text-gray-400"
                  )}
                >
                  {step.title}
                </span>
              </div>
              {index < REGISTRATION_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 transition-colors",
                    isCompleted ? "bg-green-700" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
