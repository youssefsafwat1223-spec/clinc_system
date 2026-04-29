import { Check } from 'lucide-react';

function StepperItem({ number, label, completed, active }) {
  return (
    <div className="flex items-center">
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm ${
          completed
            ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
            : active
            ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
            : 'bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20'
        }`}
      >
        {completed ? <Check className="w-5 h-5" /> : number}
      </div>
      <p
        className={`ml-3 text-sm font-medium ${
          completed ? 'text-emerald-400' : active ? 'text-blue-400' : 'text-slate-400'
        }`}
      >
        {label}
      </p>
    </div>
  );
}

export default function Stepper({ activeStep, steps }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center flex-1">
          <StepperItem
            number={index + 1}
            label={step}
            completed={index < activeStep}
            active={index === activeStep}
          />
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-1 mx-4 rounded ${
                index < activeStep
                  ? 'bg-emerald-500/30'
                  : 'bg-slate-500/10'
              }`}
            ></div>
          )}
        </div>
      ))}
    </div>
  );
}
