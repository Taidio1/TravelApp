import React from 'react';
import Card from './Card';
import { Calendar, Clock } from 'lucide-react';

interface PlannerProps {
  plans: any[];
  places: any[];
}

const Planner: React.FC<PlannerProps> = ({ plans, places }) => {
  const sortedPlans = [...plans].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] p-2">
      <div className="flex items-center gap-2 mb-2 px-2">
        <Calendar className="text-spanish-red" size={24} />
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Itinerary</h2>
      </div>

      {sortedPlans.length === 0 ? (
        <Card className="text-center text-gray-500 py-10">
          No plans for today yet. Go explore!
        </Card>
      ) : (
        sortedPlans.map((plan, index) => {
          const place = places.find(p => p.id === plan.place_id);
          if (!place) return null;

          return (
            <div key={plan.id} className="relative flex gap-4">
              {/* Timeline Connector */}
              {index !== sortedPlans.length - 1 && (
                <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-600 -z-10" />
              )}
              
              <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-700 shadow-neu-flat flex items-center justify-center text-spanish-red font-bold shrink-0">
                {index + 1}
              </div>

              <Card className="flex-1 !p-4">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">{place.name}</h4>
                  {plan.time_slot && (
                    <span className="flex items-center gap-1 text-xs text-spanish-orange font-medium">
                      <Clock size={12} /> {plan.time_slot}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{place.description}</p>
              </Card>
            </div>
          );
        })
      )}
    </div>
  );
};

export default Planner;
